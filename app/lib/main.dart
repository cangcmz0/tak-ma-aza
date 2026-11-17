import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';

void main() => runApp(const NakliyeBaronuApp());

class NakliyeBaronuApp extends StatelessWidget {
  const NakliyeBaronuApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Nakliye Baronu',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        colorSchemeSeed: const Color(0xFFF2A900),
      ),
      home: const GameScreen(),
    );
  }
}

String tl(double value) {
  final negative = value < 0;
  final digits = value.abs().round().toString();
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buffer.write('.');
    buffer.write(digits[i]);
  }
  return '${negative ? '-' : ''}$buffer ₺';
}

String tlShort(double value) {
  final abs = value.abs();
  final sign = value < 0 ? '-' : '';
  if (abs >= 1e9) return '$sign${(abs / 1e9).toStringAsFixed(2).replaceAll('.', ',')} Mr ₺';
  if (abs >= 1e6) return '$sign${(abs / 1e6).toStringAsFixed(2).replaceAll('.', ',')} Mn ₺';
  return tl(value);
}

String pct(double value) => '%${(value * 100).toStringAsFixed(1).replaceAll('.', ',')}';

String pct0(double value) => '%${(value * 100).round()}';

class VehicleType {
  const VehicleType(this.name, this.icon, this.basePrice, this.baseRevenue, this.baseCost);

  final String name;
  final IconData icon;
  final double basePrice;
  final double baseRevenue;
  final double baseCost;

  double get baseNet => baseRevenue - baseCost;
  int get roiDays => (basePrice / baseNet).round();
}

const catalog = [
  VehicleType('Kamyonet', Icons.airport_shuttle, 900000, 18000, 7000),
  VehicleType('Kamyon', Icons.local_shipping, 2400000, 47000, 21000),
  VehicleType('Tır', Icons.rv_hookup, 6500000, 127000, 62000),
];

enum LogKind { income, expense, risk, event, system }

class LogEntry {
  const LogEntry(this.day, this.text, this.kind);

  final int day;
  final String text;
  final LogKind kind;
}

class RiskOffer {
  const RiskOffer({
    required this.title,
    required this.stake,
    required this.chance,
    required this.payout,
    required this.bonus,
  });

  final String title;
  final double stake;
  final double chance;
  final double payout;
  final bool bonus;

  double get expectedProfit => chance * payout - stake;
}

class GameState extends ChangeNotifier {
  GameState() {
    reset();
  }

  static const double taxRate = 0.25;
  static const int bankruptcyGrace = 15;
  static const int riskCooldownDays = 7;
  static const List<String> _routes = [
    'Kapıkule kuyruğunu atlatan gece seferi',
    'Karlı Zigana geçidinden ekspres teslimat',
    'Habur sınırına acil jeneratör yükü',
    'Mersin Limanı\'ndan soğuk zincir konteyner',
    'Sarp üzerinden transit tekstil yükü',
    'Bayram öncesi İzmir\'e acil gıda sevkiyatı',
  ];

  final Random _rng = Random();
  final List<LogEntry> logs = [];
  Timer? _timer;

  late double cash;
  late double debt;
  late int day;
  late double priceIndex;
  late double monthlyInflation;
  late List<int> fleet;
  late int negativeDays;
  late int riskCooldown;
  late int failStreak;
  late bool bankrupt;
  late bool rescueUsed;
  late double monthProfit;
  late int speed;

  void reset() {
    cash = 1500000;
    debt = 0;
    day = 1;
    priceIndex = 1;
    monthlyInflation = 0.025;
    fleet = [1, 0, 0];
    negativeDays = 0;
    riskCooldown = 0;
    failStreak = 0;
    bankrupt = false;
    rescueUsed = false;
    monthProfit = 0;
    logs.clear();
    _log('Rahmi Usta\'dan kalan kamyonetle yola çıktın. Hedef: Nakliye Baronu olmak.', LogKind.system);
    setSpeed(1);
  }

  int get vehicleCount => fleet.fold(0, (sum, count) => sum + count);
  int get month => (day - 1) ~/ 30 % 12 + 1;
  int get year => (day - 1) ~/ 360 + 1;
  double price(int index) => catalog[index].basePrice * priceIndex;
  double get annualInflation => pow(1 + monthlyInflation, 12).toDouble() - 1;
  double get loanRate => annualInflation + 0.08;

  double get dailyRevenue {
    var total = 0.0;
    for (var i = 0; i < catalog.length; i++) {
      total += fleet[i] * catalog[i].baseRevenue;
    }
    return total * priceIndex;
  }

  double get dailyVehicleCost {
    var total = 0.0;
    for (var i = 0; i < catalog.length; i++) {
      total += fleet[i] * catalog[i].baseCost;
    }
    return total * priceIndex;
  }

  double get dailyOverhead => (4000 + 800 * pow(vehicleCount, 1.15).toDouble()) * priceIndex;
  double get dailyInterest => debt * loanRate / 360;
  double get dailyCost => dailyVehicleCost + dailyOverhead + dailyInterest;
  double get dailyNet => dailyRevenue - dailyCost;

  double get fleetValue {
    var total = 0.0;
    for (var i = 0; i < catalog.length; i++) {
      total += fleet[i] * price(i) * 0.7;
    }
    return total;
  }

  double get netWorth => cash + fleetValue - debt;
  double get loanLimit => max(0.0, fleetValue * 0.5 - debt);
  double get loanChunk => 1000000 * priceIndex;

  void setSpeed(int value) {
    speed = value;
    _timer?.cancel();
    if (value > 0 && !bankrupt) {
      _timer = Timer.periodic(Duration(milliseconds: 2000 ~/ value), (_) => _tick());
    }
    notifyListeners();
  }

  void _tick() {
    day++;
    final net = dailyNet;
    cash += net;
    monthProfit += net;
    if (riskCooldown > 0) riskCooldown--;
    if (_rng.nextDouble() < 0.05) _randomEvent();
    if ((day - 1) % 30 == 0) _closeMonth();
    _checkSolvency();
    notifyListeners();
  }

  void _closeMonth() {
    if (monthProfit > 0) {
      final tax = monthProfit * taxRate;
      cash -= tax;
      _log('Ay kapandı. Kâr: ${tl(monthProfit)} · Kurumlar vergisi: -${tl(tax)}', LogKind.expense);
    } else {
      _log('Ay zararla kapandı: ${tl(monthProfit)}. Vergi çıkmadı.', LogKind.expense);
    }
    monthProfit = 0;
    priceIndex *= 1 + monthlyInflation;
    final shock = (_rng.nextDouble() - 0.5) * 0.012;
    monthlyInflation =
        (monthlyInflation + 0.3 * (0.025 - monthlyInflation) + shock).clamp(0.008, 0.06).toDouble();
    _log('Yeni ay enflasyonu: ${pct(monthlyInflation)} · Kredi faizi: ${pct(loanRate)}', LogKind.system);
  }

  void _randomEvent() {
    if (vehicleCount == 0) return;
    final double amount;
    final String text;
    switch (_rng.nextInt(5)) {
      case 0:
        amount = -dailyVehicleCost * 4;
        text = 'Akaryakıta gece yarısı zammı geldi';
      case 1:
        amount = -(40000 + _rng.nextDouble() * 80000) * priceIndex;
        text = 'Kantarda tonaj cezası yazıldı';
      case 2:
        amount = -(60000 + _rng.nextDouble() * 140000) * priceIndex * sqrt(vehicleCount);
        text = 'Şanzıman arızası, araç sanayide';
      case 3:
        amount = dailyRevenue * (2 + _rng.nextDouble() * 2);
        text = 'Acil yük talebi, navlunlar fırladı';
      default:
        amount = (30000 + _rng.nextDouble() * 50000) * priceIndex;
        text = 'Eski müşteriden geciken tahsilat geldi';
    }
    cash += amount;
    monthProfit += amount;
    _log('$text: ${amount >= 0 ? '+' : ''}${tl(amount)}', amount >= 0 ? LogKind.income : LogKind.event);
  }

  void _checkSolvency() {
    if (cash >= 0) {
      if (negativeDays > 0) {
        negativeDays = 0;
        _log('Kasa yeniden artıya geçti. Haciz tehlikesi atlatıldı.', LogKind.system);
      }
      return;
    }
    negativeDays++;
    if (negativeDays == 1) {
      _log('Kasa ekside! $bankruptcyGrace gün içinde toparlanmazsan iflas.', LogKind.event);
    }
    if (negativeDays >= bankruptcyGrace) {
      bankrupt = true;
      _timer?.cancel();
      _log('İFLAS: Alacaklılar şirkete el koydu.', LogKind.event);
    }
  }

  bool buyVehicle(int index) {
    final cost = price(index);
    if (bankrupt || cash < cost) return false;
    cash -= cost;
    fleet[index]++;
    _log('${catalog[index].name} satın alındı: -${tl(cost)}', LogKind.expense);
    notifyListeners();
    return true;
  }

  bool takeLoan() {
    final amount = min(loanChunk, loanLimit);
    if (bankrupt || amount < 1000) return false;
    debt += amount;
    cash += amount;
    _log('Banka kredisi çekildi: +${tl(amount)} (yıllık ${pct(loanRate)})', LogKind.income);
    notifyListeners();
    return true;
  }

  bool repayLoan() {
    final amount = min(min(loanChunk, debt), cash);
    if (bankrupt || amount < 1) return false;
    debt -= amount;
    cash -= amount;
    if (debt < 1) debt = 0;
    _log('Kredi borcu ödendi: -${tl(amount)}', LogKind.expense);
    notifyListeners();
    return true;
  }

  RiskOffer? createRiskOffer() {
    if (bankrupt || vehicleCount == 0 || riskCooldown > 0) return null;
    final bonus = failStreak >= 2;
    var chance = 0.40 + _rng.nextInt(9) * 0.05;
    if (bonus) chance = min(chance + 0.15, 0.90);
    final stake = (dailyRevenue * (3 + _rng.nextDouble() * 3)).roundToDouble();
    final payout = (stake * (1.12 + _rng.nextDouble() * 0.10) / chance).roundToDouble();
    return RiskOffer(
      title: _routes[_rng.nextInt(_routes.length)],
      stake: stake,
      chance: chance,
      payout: payout,
      bonus: bonus,
    );
  }

  bool? resolveRisk(RiskOffer offer) {
    if (bankrupt || cash < offer.stake) return null;
    cash -= offer.stake;
    riskCooldown = riskCooldownDays;
    final success = _rng.nextDouble() < offer.chance;
    if (success) {
      final profit = offer.payout - offer.stake;
      cash += offer.payout;
      monthProfit += profit;
      failStreak = 0;
      _log('Risk tuttu! ${offer.title}: +${tl(profit)}', LogKind.risk);
    } else {
      monthProfit -= offer.stake;
      failStreak++;
      _log('Sefer yattı: ${offer.title}. Kayıp: -${tl(offer.stake)}', LogKind.event);
    }
    notifyListeners();
    return success;
  }

  void rescue() {
    if (!bankrupt || rescueUsed) return;
    final restructured = -min(cash, 0.0);
    rescueUsed = true;
    bankrupt = false;
    negativeDays = 0;
    debt += restructured;
    cash = 500000 * priceIndex;
    _log('Konkordato onaylandı: ${tl(restructured)} borç krediye yapılandırıldı.', LogKind.system);
    setSpeed(speed == 0 ? 1 : speed);
  }

  void _log(String text, LogKind kind) {
    logs.insert(0, LogEntry(day, text, kind));
    if (logs.length > 60) logs.removeLast();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}

class GameScreen extends StatefulWidget {
  const GameScreen({super.key});

  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen> {
  final GameState game = GameState();

  @override
  void dispose() {
    game.dispose();
    super.dispose();
  }

  void _toast(String message, {Color? color}) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message), backgroundColor: color));
  }

  void _openInvest() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (sheetContext) => ListenableBuilder(
        listenable: game,
        builder: (sheetContext, _) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Filoya Yatırım', style: Theme.of(sheetContext).textTheme.titleLarge),
                const SizedBox(height: 4),
                Text('Kasa: ${tl(game.cash)}'),
                const SizedBox(height: 12),
                for (var i = 0; i < catalog.length; i++)
                  InvestTile(
                    game: game,
                    index: i,
                    onBuy: () {
                      if (game.buyVehicle(i)) {
                        _toast('${catalog[i].name} filoya katıldı!');
                      }
                    },
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _openRisk() async {
    final errorColor = Theme.of(context).colorScheme.error;
    final offer = game.createRiskOffer();
    if (offer == null) {
      _toast(game.vehicleCount == 0
          ? 'Önce en az bir araç almalısın.'
          : 'Şoförler dinleniyor: ${game.riskCooldown} gün sonra yeni riskli sefer.');
      return;
    }
    final accepted = await showDialog<bool>(
      context: context,
      builder: (_) => RiskDialog(offer: offer, canAfford: game.cash >= offer.stake),
    );
    if (accepted != true || !mounted) return;
    final result = game.resolveRisk(offer);
    if (result == null) {
      _toast('Kasada yeterli nakit kalmadı.');
      return;
    }
    _toast(
      result
          ? 'Sefer başarılı! Net kâr: +${tl(offer.payout - offer.stake)}'
          : 'Sefer yattı. Kayıp: -${tl(offer.stake)}',
      color: result ? Colors.green.shade700 : errorColor,
    );
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: game,
      builder: (context, _) {
        final scheme = Theme.of(context).colorScheme;
        return Scaffold(
          appBar: AppBar(
            title: const Text('Nakliye Baronu', style: TextStyle(fontWeight: FontWeight.w800)),
            actions: [
              for (final entry in const [(0, Icons.pause), (1, Icons.play_arrow), (3, Icons.fast_forward)])
                IconButton(
                  onPressed: game.bankrupt ? null : () => game.setSpeed(entry.$1),
                  icon: Icon(entry.$2),
                  color: game.speed == entry.$1 ? scheme.primary : null,
                ),
            ],
          ),
          body: SafeArea(
            child: Stack(
              fit: StackFit.expand,
              children: [
                ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    BalanceCard(game: game),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: FilledButton.icon(
                            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(56)),
                            onPressed: game.bankrupt ? null : _openInvest,
                            icon: const Icon(Icons.trending_up),
                            label: const Text('Yatırım Yap', style: TextStyle(fontWeight: FontWeight.bold)),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: FilledButton.tonalIcon(
                            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(56)),
                            onPressed: game.bankrupt ? null : _openRisk,
                            icon: const Icon(Icons.alt_route),
                            label: Text(
                              game.riskCooldown > 0 ? 'Risk Al (${game.riskCooldown}g)' : 'Risk Al',
                              style: const TextStyle(fontWeight: FontWeight.bold),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: !game.bankrupt && game.loanLimit >= 1000
                                ? () => _toast(game.takeLoan() ? 'Kredi hesaba geçti.' : 'Kredi limiti yetersiz.')
                                : null,
                            icon: const Icon(Icons.account_balance),
                            label: Text('Kredi Çek (${tlShort(min(game.loanChunk, game.loanLimit))})'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: !game.bankrupt && game.debt > 0 && game.cash > 0 ? game.repayLoan : null,
                            icon: const Icon(Icons.payments_outlined),
                            label: const Text('Borç Öde'),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    FleetCard(game: game),
                    const SizedBox(height: 16),
                    LogCard(game: game),
                  ],
                ),
                if (game.bankrupt) BankruptOverlay(game: game),
              ],
            ),
          ),
        );
      },
    );
  }
}

class BalanceCard extends StatelessWidget {
  const BalanceCard({super.key, required this.game});

  final GameState game;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final net = game.dailyNet;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  'Yıl ${game.year} · Ay ${game.month} · Gün ${game.day}',
                  style: TextStyle(color: scheme.onSurfaceVariant),
                ),
                const Spacer(),
                if (game.negativeDays > 0)
                  Text(
                    'İflasa ${GameState.bankruptcyGrace - game.negativeDays} gün',
                    style: TextStyle(color: scheme.error, fontWeight: FontWeight.bold),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Text('Kasa', style: TextStyle(color: scheme.onSurfaceVariant)),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                tl(game.cash),
                style: TextStyle(
                  fontSize: 36,
                  fontWeight: FontWeight.w900,
                  color: game.cash < 0 ? scheme.error : scheme.primary,
                ),
              ),
            ),
            const SizedBox(height: 16),
            LayoutBuilder(
              builder: (context, constraints) {
                final width = (constraints.maxWidth - 12) / 2;
                return Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    StatTile(width: width, label: 'Net Değer', value: tlShort(game.netWorth)),
                    StatTile(
                      width: width,
                      label: 'Günlük Net',
                      value: tlShort(net),
                      color: net >= 0 ? Colors.greenAccent : scheme.error,
                    ),
                    StatTile(width: width, label: 'Günlük Gelir', value: tlShort(game.dailyRevenue)),
                    StatTile(width: width, label: 'Günlük Gider', value: tlShort(game.dailyCost)),
                    StatTile(width: width, label: 'Aylık Enflasyon', value: pct(game.monthlyInflation)),
                    StatTile(width: width, label: 'Kredi Faizi (yıllık)', value: pct(game.loanRate)),
                    StatTile(width: width, label: 'Borç', value: tlShort(game.debt)),
                    StatTile(
                      width: width,
                      label: 'Bu Ay Kâr',
                      value: tlShort(game.monthProfit),
                      color: game.monthProfit >= 0 ? null : scheme.error,
                    ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class StatTile extends StatelessWidget {
  const StatTile({super.key, required this.width, required this.label, required this.value, this.color});

  final double width;
  final String label;
  final String value;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      width: width,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: scheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 12, color: scheme.onSurfaceVariant)),
          const SizedBox(height: 4),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(value, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: color)),
          ),
        ],
      ),
    );
  }
}

class InvestTile extends StatelessWidget {
  const InvestTile({super.key, required this.game, required this.index, required this.onBuy});

  final GameState game;
  final int index;
  final VoidCallback onBuy;

  @override
  Widget build(BuildContext context) {
    final type = catalog[index];
    final cost = game.price(index);
    return Card(
      child: ListTile(
        leading: Icon(type.icon, size: 32),
        title: Text('${type.name}  (sende: ${game.fleet[index]})'),
        subtitle: Text(
          'Günlük net: ${tlShort(type.baseNet * game.priceIndex)}\nGeri dönüş: ~${type.roiDays} gün',
        ),
        isThreeLine: true,
        trailing: FilledButton(
          onPressed: !game.bankrupt && game.cash >= cost ? onBuy : null,
          child: Text(tlShort(cost)),
        ),
      ),
    );
  }
}

class FleetCard extends StatelessWidget {
  const FleetCard({super.key, required this.game});

  final GameState game;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Filo (${game.vehicleCount} araç)', style: Theme.of(context).textTheme.titleMedium),
            for (var i = 0; i < catalog.length; i++)
              ListTile(
                contentPadding: EdgeInsets.zero,
                dense: true,
                leading: Icon(catalog[i].icon),
                title: Text('${catalog[i].name} × ${game.fleet[i]}'),
                trailing: Text('${tlShort(game.fleet[i] * catalog[i].baseNet * game.priceIndex)} / gün'),
              ),
            const Divider(),
            _costRow('Ofis ve yönetim gideri', game.dailyOverhead, scheme),
            _costRow('Kredi faizi', game.dailyInterest, scheme),
            _costRow('Filo piyasa değeri', game.fleetValue, scheme, perDay: false),
          ],
        ),
      ),
    );
  }

  Widget _costRow(String label, double value, ColorScheme scheme, {bool perDay = true}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(child: Text(label, style: TextStyle(color: scheme.onSurfaceVariant))),
          Text(perDay ? '-${tlShort(value)} / gün' : tlShort(value)),
        ],
      ),
    );
  }
}

class LogCard extends StatelessWidget {
  const LogCard({super.key, required this.game});

  final GameState game;

  Color _color(LogKind kind, ColorScheme scheme) => switch (kind) {
        LogKind.income => Colors.greenAccent,
        LogKind.expense => scheme.onSurface,
        LogKind.risk => scheme.primary,
        LogKind.event => Colors.redAccent,
        LogKind.system => scheme.onSurfaceVariant,
      };

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Olay Günlüğü', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            for (final entry in game.logs.take(30))
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: 52,
                      child: Text('G${entry.day}', style: TextStyle(color: scheme.onSurfaceVariant)),
                    ),
                    Expanded(child: Text(entry.text, style: TextStyle(color: _color(entry.kind, scheme)))),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class RiskDialog extends StatelessWidget {
  const RiskDialog({super.key, required this.offer, required this.canAfford});

  final RiskOffer offer;
  final bool canAfford;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return AlertDialog(
      title: const Text('Riskli Sefer Teklifi'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(offer.title, style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 16),
          _row('Ön maliyet (yakıt + avans)', tl(offer.stake)),
          _row('Başarı ihtimali', pct0(offer.chance)),
          _row('Başarıda tahsilat', tl(offer.payout)),
          _row('Beklenen kâr', tl(offer.expectedProfit)),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: offer.chance,
              minHeight: 10,
              backgroundColor: scheme.error.withValues(alpha: 0.35),
              color: Colors.greenAccent,
            ),
          ),
          if (offer.bonus)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(
                'Tecrübe bonusu: Üst üste kayıplardan sonra şansın +%15 arttı.',
                style: TextStyle(color: scheme.tertiary),
              ),
            ),
          if (!canAfford)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text('Kasada yeterli nakit yok.', style: TextStyle(color: scheme.error)),
            ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Vazgeç')),
        FilledButton(
          onPressed: canAfford ? () => Navigator.pop(context, true) : null,
          child: const Text('Riske Gir'),
        ),
      ],
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(child: Text(label)),
          const SizedBox(width: 12),
          Text(value, style: const TextStyle(fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}

class BankruptOverlay extends StatelessWidget {
  const BankruptOverlay({super.key, required this.game});

  final GameState game;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return ColoredBox(
      color: Colors.black87,
      child: Center(
        child: Card(
          margin: const EdgeInsets.all(24),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.gavel, size: 56, color: scheme.error),
                const SizedBox(height: 12),
                Text(
                  'İFLAS ETTİN',
                  style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: scheme.error),
                ),
                const SizedBox(height: 8),
                Text('Gün ${game.day} · Net değer: ${tlShort(game.netWorth)}', textAlign: TextAlign.center),
                const SizedBox(height: 20),
                if (!game.rescueUsed)
                  FilledButton.icon(
                    onPressed: game.rescue,
                    icon: const Icon(Icons.ondemand_video),
                    label: const Text('Reklam İzle: Konkordato İlan Et'),
                  ),
                const SizedBox(height: 8),
                OutlinedButton(onPressed: game.reset, child: const Text('Sıfırdan Başla')),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
