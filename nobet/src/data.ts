// Oyunun sabit içeriği: alanlar, tedaviler, şikâyetler, geceler.

export type Zone = 'red' | 'yellow' | 'green';
export const ZONES: Zone[] = ['red', 'yellow', 'green'];
export const ZONE_RANK: Record<Zone, number> = { green: 0, yellow: 1, red: 2 };
export const ZONE_INFO: Record<Zone, { name: string; area: string; role: string }> = {
  red: { name: 'Kırmızı', area: 'Kırmızı Alan', role: 'Resüsitasyon' },
  yellow: { name: 'Sarı', area: 'Sarı Alan', role: 'Müşahede' },
  green: { name: 'Yeşil', area: 'Yeşil Alan', role: 'Poliklinik' },
};

export type ToolId = 'ekg' | 'oksijen' | 'rontgen' | 'serum' | 'ilac' | 'igne' | 'dikis';
export const TOOLS: Record<ToolId, { emoji: string; name: string }> = {
  ekg: { emoji: '🫀', name: 'EKG' },
  oksijen: { emoji: '🫁', name: 'Oksijen' },
  rontgen: { emoji: '🩻', name: 'Röntgen' },
  serum: { emoji: '💧', name: 'Serum' },
  ilac: { emoji: '💊', name: 'İlaç' },
  igne: { emoji: '💉', name: 'İğne' },
  dikis: { emoji: '🪡', name: 'Dikiş' },
};
export const TOOL_ORDER: ToolId[] = ['ekg', 'oksijen', 'rontgen', 'serum', 'ilac', 'igne', 'dikis'];

export type VitalTarget = 'nabiz' | 'ates' | 'spo2' | 'sistolik';
/** Bu şikâyette hangi bulgu hangi yöne bozulabilir (1 = yükselir, -1 = düşer). */
export interface Focus { v: VitalTarget; dir: 1 | -1 }

export interface Complaint {
  id: string;
  emoji: string;
  title: string;
  tool: ToolId;
  /** İlk görüldüğü gece. */
  night: number;
  /** Hangi aciliyetle gelebilir ve o zaman ne der. */
  lines: Partial<Record<Zone, string[]>>;
  /** Çocuk hasta gelirse söyledikleri (yoksa çocuk gelmez). */
  kid?: Partial<Record<Zone, string[]>>;
  focus: Focus[];
}

export const COMPLAINTS: Complaint[] = [
  {
    id: 'rapor', emoji: '📄', title: 'Rapor / reçete', tool: 'ilac', night: 1,
    lines: {
      green: [
        'İşe gitmemek için rapor lazım.',
        'Annemin ilaçlarını yazdırmaya geldim.',
        'Gündüz sıra çok, gece geleyim dedim.',
        'Spor salonu sağlık raporu istiyor.',
        'Sabah sınavım var, rapor alabilir miyim?',
      ],
    },
    focus: [],
  },
  {
    id: 'grip', emoji: '🤧', title: 'Grip / nezle', tool: 'ilac', night: 1,
    lines: {
      yellow: ['Üç gündür ateşim var, öksürükten uyuyamıyorum.', 'Grip oldum, eklemlerim kırılıyor.'],
      green: [
        'Üç gündür burnum akıyor.',
        'Gece 3’te boğazım gıcıklandı, hemen geldim.',
        'Hapşırıyorum, sabah önemli toplantım var.',
      ],
    },
    kid: { green: ['Burnum akıyor, öksürüyorum.'] },
    focus: [{ v: 'ates', dir: 1 }, { v: 'nabiz', dir: 1 }],
  },
  {
    id: 'dusme', emoji: '🦴', title: 'Düşme / kırık şüphesi', tool: 'rontgen', night: 1,
    lines: {
      red: ['İskeleden düştüm… başım dönüyor… her yer kararıyor…', 'Motordan düştüm, bacağım ters duruyor!'],
      yellow: [
        'Halı sahada bileğim döndü, şişti.',
        'Merdivenden düştüm, bileğimi oynatamıyorum.',
        'Buzda kaydım, kolum çok ağrıyor.',
      ],
      green: [
        'Kapıya çarptım, serçe parmağım morardı.',
        'Düştüm ama bir şeyim yok galiba, eşim zorla getirdi.',
        'Dizimi sehpaya vurdum.',
      ],
    },
    kid: {
      yellow: ['Trambolinden düştüm, kolum acıyor.', 'Bisikletten düştüm, bileğim şişti.'],
      green: ['Bahçede düştüm, dizim sıyrıldı.'],
    },
    focus: [{ v: 'nabiz', dir: 1 }, { v: 'sistolik', dir: -1 }],
  },
  {
    id: 'kesik', emoji: '🩸', title: 'Kesik', tool: 'dikis', night: 1,
    lines: {
      red: ['Cam kesti, kan durmuyor!', 'Bıçak kaydı, havlu kıpkırmızı oldu!'],
      yellow: ['Karpuz keserken elimi kestim.', 'Konserve kapağı parmağımı derin kesti.'],
      green: ['Bıçak parmağımı sıyırdı, kanı durmadı.', 'Kırık bardak elimi çizdi.'],
    },
    kid: { yellow: ['Cam kırıldı, elimi kestim.'], green: ['Makas parmağımı kesti.'] },
    focus: [{ v: 'nabiz', dir: 1 }, { v: 'sistolik', dir: -1 }],
  },
  {
    id: 'gogus', emoji: '💔', title: 'Göğüs ağrısı', tool: 'ekg', night: 1,
    lines: {
      red: ['Göğsüme fil oturmuş gibi!', 'Sol kolum uyuşuyor, soğuk soğuk terliyorum.', 'Göğsüm sıkışıyor, nefesim kesiliyor…'],
      yellow: ['Göğsümde bir sıkışma var, geçmedi.', 'Çarpıntım bir saattir durmuyor.', 'Merdiven çıkınca göğsüm ağrıyor.'],
      green: [
        'Maç izlerken kalbim hızlandı, gol olunca geçti.',
        'İnternette okudum, kalp krizi geçiriyorum galiba.',
        'Üç Türk kahvesi içtim, kalbim pır pır.',
      ],
    },
    focus: [{ v: 'nabiz', dir: 1 }, { v: 'sistolik', dir: 1 }, { v: 'nabiz', dir: -1 }, { v: 'sistolik', dir: -1 }],
  },
  {
    id: 'nefes', emoji: '😮‍💨', title: 'Nefes darlığı', tool: 'oksijen', night: 2,
    lines: {
      red: ['Ne… fes… ala… mıyorum…', 'Dudaklarım morardı, havam yetmiyor!', 'Hırıltım arttı, konuşamıyorum.'],
      yellow: ['Astımım azdı, spreyim bitti.', 'Merdiven çıkınca boğuluyorum.', 'Öksürükten nefesim daralıyor.'],
    },
    focus: [{ v: 'spo2', dir: -1 }, { v: 'nabiz', dir: 1 }],
  },
  {
    id: 'kusma', emoji: '🤢', title: 'Kusma / ishal', tool: 'serum', night: 2,
    lines: {
      red: ['Sabahtan beri kusuyorum, ayakta duramıyorum…', 'Gözüm kararıyor, su bile tutamıyorum.'],
      yellow: ['Düğünde midye yedim…', 'Lahmacun dokundu, durmadan kusuyorum.', 'Bayram yemeğinden beri ishalim.'],
      green: ['Biraz midem bulanıyor.', 'Akşam çok yedim, şişkinim.', 'Üç porsiyon mantı yedim, pişmanım.'],
    },
    kid: { yellow: ['Bütün gece kustum, karnım ağrıyor.'], green: ['Çok şeker yedim, midem bulanıyor.'] },
    focus: [{ v: 'nabiz', dir: 1 }, { v: 'sistolik', dir: -1 }, { v: 'ates', dir: 1 }],
  },
  {
    id: 'ates', emoji: '🤒', title: 'Yüksek ateş', tool: 'ilac', night: 2,
    lines: {
      red: ['Titriyorum, ateşim 40’ı geçti, sayıklıyorum.', 'Ateşten gözüm hiçbir şey görmüyor.'],
      yellow: ['Ateşim düşmüyor, her yerim ağrıyor.', 'İki gündür ateşim var, ilaç işe yaramadı.'],
      green: ['Hafif ateşim var gibi, ölçmedim.', 'Alnım sıcak, annem gönderdi.'],
    },
    kid: {
      red: ['Ateşim çok yüksek, titriyorum.'],
      yellow: ['Ateşim var, başım çok ağrıyor.'],
      green: ['Okula gitmek istemiyorum… yani ateşim var.'],
    },
    focus: [{ v: 'ates', dir: 1 }, { v: 'nabiz', dir: 1 }],
  },
  {
    id: 'alerji', emoji: '🐝', title: 'Alerji', tool: 'igne', night: 3,
    lines: {
      red: ['Arı soktu, boğazım şişiyor!', 'Fıstık yedim, dilim şişti, nefes…'],
      yellow: ['Yeni deterjan, her yerim kaşınıyor.', 'Kedi sevdim, gözlerim şişti.'],
    },
    kid: { yellow: ['Çilek yedim, her yerim kızardı.'] },
    focus: [{ v: 'spo2', dir: -1 }, { v: 'sistolik', dir: -1 }, { v: 'nabiz', dir: 1 }],
  },
  {
    id: 'tansiyon', emoji: '🤕', title: 'Baş ağrısı / tansiyon', tool: 'igne', night: 3,
    lines: {
      red: ['Başım çatlıyor, gözüm kararıyor!', 'Ensem zonkluyor, kusacak gibiyim.'],
      yellow: ['Tansiyonum çıktı, ensem ağrıyor.', 'Turşuyu fazla kaçırdım, tansiyon fırladı.'],
      green: ['Uykusuzluktan başım ağrıyor.', 'Telefona çok baktım, başım ağrıdı.'],
    },
    focus: [{ v: 'sistolik', dir: 1 }],
  },
  {
    id: 'igne', emoji: '🙋', title: 'İğne isteği', tool: 'igne', night: 3,
    lines: {
      green: [
        'Bir iğne vurun, geçer.',
        'Her kış bir vitamin iğnesi yaptırırım.',
        'Belim tuttu, ağrı kesici iğne lazım.',
      ],
    },
    focus: [],
  },
];

export const COMPLAINT_BY_ID: Record<string, Complaint> = Object.fromEntries(COMPLAINTS.map((c) => [c.id, c]));

export function severitiesOf(c: Complaint): Zone[] {
  return ZONES.filter((z) => (c.lines[z]?.length ?? 0) > 0);
}

export interface NightCfg {
  /** Hikâye gecesi numarası; Günün Nöbeti için 0. */
  n: number;
  /** Hangi gecenin şikâyet ve tedavileri geçerli. */
  pool: number;
  /** Günün Nöbeti ise tarih anahtarı (YYYY-AA-GG). */
  daily: string | null;
  title: string;
  blurb: string;
  /** Gerçek saniye cinsinden nöbet süresi (23:00 → 08:00). */
  duration: number;
  /** İki hasta arası saniye aralığı. */
  spawn: [number, number];
  weights: Record<Zone, number>;
  /** 2: bulgular renkli + öneri, 1: yalnız bulgular renkli, 0: ipucu yok. */
  hints: 0 | 1 | 2;
  /** Ambulans aralığı (sn) ya da yok. */
  ambulance: [number, number] | null;
  /** Bağıran hasta yakını aralığı (sn) ya da yok. */
  relatives: [number, number] | null;
  /** Bu gece daha sık gelen şikâyetler. */
  theme: Record<string, number>;
  beds: Record<Zone, number>;
  tutorial: boolean;
}

type StoryNight = Omit<NightCfg, 'n' | 'pool' | 'daily'>;

const NIGHTS: StoryNight[] = [
  {
    title: 'İlk Nöbet',
    blurb: 'Stajyerliğinin ilk gecesi. Sakin başlıyor… şimdilik.',
    duration: 150, spawn: [7, 10], weights: { red: 0.15, yellow: 0.35, green: 0.5 },
    hints: 2, ambulance: null, relatives: null, theme: {}, beds: { red: 2, yellow: 3, green: 3 }, tutorial: true,
  },
  {
    title: 'Cuma Gecesi',
    blurb: 'Hafta sonu başladı. 112 artık seni de arıyor.',
    duration: 165, spawn: [6, 8.5], weights: { red: 0.2, yellow: 0.4, green: 0.4 },
    hints: 1, ambulance: [45, 60], relatives: null, theme: { kesik: 1.5, dusme: 1.3 }, beds: { red: 2, yellow: 3, green: 3 }, tutorial: false,
  },
  {
    title: 'Derbi Gecesi',
    blurb: 'Maç uzatmaya gitti. Taraftar yakınlar da acile doluştu.',
    duration: 175, spawn: [5.2, 7.8], weights: { red: 0.22, yellow: 0.4, green: 0.38 },
    hints: 1, ambulance: [40, 55], relatives: [32, 46], theme: { gogus: 2, dusme: 1.5 }, beds: { red: 2, yellow: 3, green: 3 }, tutorial: false,
  },
  {
    title: 'Bayram Arifesi',
    blurb: 'Sofralar kuruldu, mideler pes etti. Renk ipuçları artık yok.',
    duration: 180, spawn: [4.8, 7.2], weights: { red: 0.25, yellow: 0.4, green: 0.35 },
    hints: 0, ambulance: [38, 50], relatives: [30, 42], theme: { kusma: 2.5, tansiyon: 1.5 }, beds: { red: 3, yellow: 3, green: 3 }, tutorial: false,
  },
  {
    title: 'Kar Fırtınası',
    blurb: 'Yollar buz tuttu. Herkes kayıyor, herkes sana geliyor.',
    duration: 190, spawn: [4.2, 6.2], weights: { red: 0.28, yellow: 0.4, green: 0.32 },
    hints: 0, ambulance: [35, 48], relatives: [28, 40], theme: { dusme: 2.5, nefes: 1.5 }, beds: { red: 3, yellow: 3, green: 3 }, tutorial: false,
  },
];

export const STORY_NIGHTS = NIGHTS.length;
/** Bütün şikâyetlerin açıldığı gece. */
export const FULL_POOL = Math.max(...COMPLAINTS.map((c) => c.night));

export function nightConfig(n: number): NightCfg {
  if (n <= NIGHTS.length) return { n, pool: n, daily: null, ...NIGHTS[n - 1] };
  // Hikâye geceleri bitince her gece biraz daha zorlaşır.
  const k = n - NIGHTS.length;
  const shrink = Math.max(0.68, 1 - k * 0.06);
  return {
    n,
    pool: n,
    daily: null,
    title: `${n}. Gece`,
    blurb: 'Uzman oldun. Nöbetler bitmiyor.',
    duration: 190,
    spawn: [4.2 * shrink, 6.2 * shrink],
    weights: { red: Math.min(0.34, 0.28 + k * 0.01), yellow: 0.4, green: Math.max(0.26, 0.32 - k * 0.01) },
    hints: 0,
    ambulance: [Math.max(26, 35 - k * 2), Math.max(36, 48 - k * 2)],
    relatives: [Math.max(22, 28 - k), Math.max(32, 40 - k)],
    theme: {},
    beds: { red: 3, yellow: 3, green: 3 },
    tutorial: false,
  };
}

/** Günün Nöbeti'nin teması tarihe göre döner. */
export const DAILY_THEMES: { title: string; blurb: string; theme: Record<string, number> }[] = [
  { title: 'Polen Mevsimi', blurb: 'Ağaçlar çiçek açtı, burunlar ve bronşlar isyanda.', theme: { alerji: 2.5, nefes: 1.6 } },
  { title: 'Düğün Sezonu', blurb: 'Pilav, midye, halay. Sabaha karşı hepsi acilde.', theme: { kusma: 2.2, kesik: 1.5 } },
  { title: 'Derbi Akşamı', blurb: 'Son dakika golü kalpleri hızlandırdı.', theme: { gogus: 2, dusme: 1.6 } },
  { title: 'İlk Kar', blurb: 'Kaldırımlar buz, kalçalar risk altında.', theme: { dusme: 2.5, nefes: 1.4 } },
  { title: 'Sınav Haftası', blurb: 'Herkes bir rapor peşinde, tansiyonlar tavanda.', theme: { rapor: 2.2, tansiyon: 1.6, igne: 1.4 } },
  { title: 'Grip Salgını', blurb: 'Bütün şehir hapşırıyor, ateşler düşmüyor.', theme: { grip: 2.5, ates: 2 } },
  { title: 'Bayram Sofrası', blurb: 'Baklava üstüne sarma, sarma üstüne tatlı.', theme: { kusma: 2.5, tansiyon: 1.6 } },
  { title: 'Dolunay', blurb: 'Eski nöbetçiler bilir: dolunayda acil hiç susmaz.', theme: { kesik: 1.4, gogus: 1.4, alerji: 1.3 } },
];

export function dailyConfig(key: string, seed: number): NightCfg {
  const t = DAILY_THEMES[seed % DAILY_THEMES.length];
  return {
    n: 0,
    pool: FULL_POOL,
    daily: key,
    title: t.title,
    blurb: t.blurb,
    duration: 180,
    spawn: [5, 7.5],
    weights: { red: 0.24, yellow: 0.4, green: 0.36 },
    hints: 1,
    ambulance: [40, 55],
    relatives: [32, 46],
    theme: t.theme,
    beds: { red: 2, yellow: 3, green: 3 },
    tutorial: false,
  };
}

export const RELATIVE_LINES = [
  'Hocam önce bize bakın!',
  'İki saattir bekliyoruz!',
  'Benim dayım burada müdür!',
  'Sosyal medyaya yazacağım!',
  'Bizim hasta ölüyor, siz çay içiyorsunuz!',
  'Bu nasıl hastane ya!',
  'Hemşire hanım bakmadı bile!',
  'Torpilim var, haberin olsun!',
];

export function complaintsFor(n: number): Complaint[] {
  return COMPLAINTS.filter((c) => c.night <= n);
}

export function toolsFor(n: number): ToolId[] {
  const used = new Set(complaintsFor(n).map((c) => c.tool));
  return TOOL_ORDER.filter((t) => used.has(t));
}

/** O gece ilk kez görülen şikâyetler ve tedaviler. */
export function newThingsFor(n: number): { complaints: Complaint[]; tools: ToolId[] } {
  const before = n > 1 ? new Set(toolsFor(n - 1)) : new Set<ToolId>();
  return {
    complaints: COMPLAINTS.filter((c) => c.night === n),
    tools: toolsFor(n).filter((t) => !before.has(t)),
  };
}

export const NAMES = {
  m: ['Mehmet', 'Ahmet', 'Mustafa', 'Emre', 'Burak', 'Hasan', 'Hüseyin', 'Murat', 'Can', 'Kerem', 'Yusuf', 'Ömer', 'İbrahim', 'Serkan', 'Oğuz', 'Kemal', 'Rıza', 'Cengiz'],
  f: ['Ayşe', 'Fatma', 'Zeynep', 'Elif', 'Emine', 'Hatice', 'Merve', 'Büşra', 'Selin', 'Esra', 'Derya', 'Sultan', 'Gül', 'Nur', 'Ceren', 'Şule', 'Hayriye', 'Nermin'],
  initials: 'ABCDEFGHİKLMNOÖPRSŞTUÜYZ',
};

export const AVATARS = {
  kid: { m: ['👦'], f: ['👧'] },
  adult: { m: ['👨', '🧔', '👨‍🦱', '🧑'], f: ['👩', '👱‍♀️', '👩‍🦱', '🧕'] },
  old: { m: ['👴', '👨‍🦳'], f: ['👵', '👩‍🦳'] },
};
