// Toda a geometria é em milímetros, com origem no canto superior esquerdo
// da traseira do aparelho (a área de impressão da capa).

export type Hole = {
  x: number;
  y: number;
  w: number;
  h: number;
  /** raio do canto; use w/2 para furo redondo */
  r: number;
};

export type Lens = {
  /** centro */
  x: number;
  y: number;
  /** diâmetro */
  d: number;
  kind?: "lens" | "flash" | "sensor";
};

export type DeviceGeometry = {
  width: number;
  height: number;
  radius: number;
  /** recortes da capa (já com folga) */
  holes: Hole[];
  /** elementos visuais do aparelho dentro dos recortes */
  lenses: Lens[];
  /** medidas deduzidas da foto do mockup; precisam ser conferidas */
  estimated?: boolean;
};

/**
 * Fotos do aparelho com capa (Case4You). Todas as camadas têm o mesmo quadro;
 * `print` é a área imprimível dentro dele, que corresponde a `geometry`.
 */
export type DeviceMockup = {
  background: string;
  border: string | null;
  mask: string;
  overlay: string | null;
  frame: { w: number; h: number };
  print: { x: number; y: number; w: number; h: number };
};

export type DeviceSeed = {
  id: string;
  brand: string;
  name: string;
  /** ordem nos "mais pedidos"; menor = mais popular */
  rank: number;
  geometry: DeviceGeometry;
};

export type Device = DeviceSeed & {
  active: boolean;
  verified: boolean;
  mockup: DeviceMockup | null;
};
