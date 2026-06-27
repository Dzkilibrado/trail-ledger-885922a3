/**
 * Catálogo de marcas, modelos, cilindradas e tipos para o formulário de cadastro.
 * Mantenha "Outros" como última opção em cada lista — quando selecionado, o
 * formulário libera input livre.
 */

export const OTHER = "__other__";

export const MODELS_BY_BRAND: Record<string, string[]> = {
  Honda: [
    "CRF 230F", "CRF 250F", "CRF 250R", "CRF 250RX", "CRF 300L", "CRF 300L Rally",
    "CRF 450R", "CRF 450RX", "CRF 450X", "XR 250 Tornado", "XR 150L", "XR 200R",
  ],
  Yamaha: [
    "WR 250F", "WR 450F", "YZ 125", "YZ 250", "YZ 250F", "YZ 450F",
    "Lander 250", "Tenere 250", "TT-R 230",
  ],
  KTM: [
    "150 EXC", "250 EXC", "300 EXC", "250 EXC-F", "350 EXC-F", "450 EXC-F", "500 EXC-F",
    "250 SX", "350 SX-F", "450 SX-F", "Freeride 250F",
  ],
  GasGas: [
    "EC 250", "EC 300", "EC 250F", "EC 350F", "EC 450F",
    "MC 250F", "MC 350F", "MC 450F",
  ],
  Husqvarna: [
    "TE 150", "TE 250", "TE 300", "FE 250", "FE 350", "FE 450", "FE 501",
    "TX 300", "FX 350", "FX 450",
  ],
  Beta: ["RR 200", "RR 250", "RR 300", "RR 350", "RR 390", "RR 430", "RR 480", "Xtrainer 300"],
  Sherco: ["SE 250", "SE 300", "SEF 250", "SEF 300", "SEF 450"],
  Kawasaki: ["KLX 230", "KLX 300", "KX 250", "KX 450"],
  Suzuki: ["DR 200", "DR-Z 400"],
  Outra: [],
};

export const DISPLACEMENTS = [
  "125", "150", "200", "230", "250", "300", "350", "400", "450", "500", "501",
];

export const MOTO_TYPES = [
  { value: "trail_light", label: "Trilha leve" },
  { value: "enduro", label: "Enduro" },
  { value: "cross", label: "MotoCross" },
  { value: "rally", label: "Rally" },
  { value: "adventure", label: "Adventure" },
  { value: "trail_2t", label: "Trilha 2 tempos" },
] as const;

export const CONTROL_TYPES = [
  { value: "hours", label: "Horímetro" },
  { value: "km", label: "Hodômetro (km)" },
  { value: "both", label: "Ambos" },
] as const;

/** Lista decrescente: do ano vigente +1 até 1990. */
export function yearOptions(): number[] {
  const max = new Date().getFullYear() + 1;
  const out: number[] = [];
  for (let y = max; y >= 1990; y--) out.push(y);
  return out;
}

export const INCIDENT_TYPES = [
  { value: "minor_fall", label: "Queda leve" },
  { value: "major_fall", label: "Queda grave" },
  { value: "crash", label: "Acidente / Batida" },
  { value: "submersion", label: "Submersão" },
  { value: "engine_damage", label: "Danos no motor" },
  { value: "frame_damage", label: "Danos no chassi" },
  { value: "structural", label: "Quebra estrutural" },
  { value: "theft_recovered", label: "Roubo/furto recuperado" },
  { value: "other", label: "Outro" },
] as const;

export const INCIDENT_DECLARATION_TEXT =
  "Declaro que, até onde tenho conhecimento, esta motocicleta não possui histórico de sinistro relevante. " +
  "Estou ciente de que esta informação poderá compor o histórico da moto e impactar sua certificação.";