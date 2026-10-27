import "server-only";
import {
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFOperator,
  PDFOperatorNames as Ops,
  concatTransformationMatrix,
  drawObject,
  popGraphicsState,
  pushGraphicsState,
  setGraphicsState,
} from "pdf-lib";
import { PNG } from "pngjs";

const PT_PER_MM = 72 / 25.4;

/**
 * Arquivo único para a Mimaki: página no tamanho real da traseira (mm),
 * a camada de branco numa cor especial (spot color) e, por cima, a arte em 300 dpi.
 * A arte vai com sobreimpressão para não "furar" o branco na separação — o RasterLink
 * separa o branco pelo nome. Em visualizadores comuns a arte cobre o branco e aparece normal.
 * Sem recorte de câmera: a impressão passa por cima e a tinta não pega no furo.
 */
export async function buildPrintPdf(opts: {
  png: Uint8Array;
  widthMm: number;
  heightMm: number;
  spotName: string;
  title: string;
}) {
  const doc = await PDFDocument.create();
  doc.setTitle(opts.title);
  doc.setCreator("Estúdio de capas");
  const ctx = doc.context;
  const W = opts.widthMm * PT_PER_MM;
  const H = opts.heightMm * PT_PER_MM;
  const page = doc.addPage([W, H]);
  // TrimBox = área real da capa
  page.setTrimBox(0, 0, W, H);

  const art = await doc.embedPng(opts.png);

  // máscara de 1 bit: 1 onde há tinta (alfa > 10, mesma regra da camada de branco em PNG)
  const img = PNG.sync.read(Buffer.from(opts.png));
  const rowBytes = Math.ceil(img.width / 8);
  const bits = new Uint8Array(rowBytes * img.height);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.data[(y * img.width + x) * 4 + 3] > 10) bits[y * rowBytes + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  const mask = ctx.register(
    ctx.flateStream(bits, {
      Type: "XObject",
      Subtype: "Image",
      Width: img.width,
      Height: img.height,
      ImageMask: true,
      BitsPerComponent: 1,
      Decode: [1, 0],
    }),
  );

  // cor de exibição na tela (ciano claro); na Mimaki o que vale é o nome
  const tint = ctx.register(ctx.obj({ FunctionType: 2, Domain: [0, 1], C0: [0, 0, 0, 0], C1: [0.2, 0, 0, 0], N: 1 }));
  const spot = ctx.register(ctx.obj(["Separation", opts.spotName, "DeviceCMYK", tint]));
  const overprint = ctx.register(ctx.obj({ Type: "ExtGState", OP: true, op: true, OPM: 1 }));

  const { Resources } = page.node.normalizedEntries();
  Resources.set(PDFName.of("ColorSpace"), ctx.obj({ CSWhite: spot }));
  const gs = page.node.newExtGState("GSOverprint", overprint);
  const whiteXo = page.node.newXObject("WhiteLayer", mask);
  const artXo = page.node.newXObject("Art", art.ref);

  page.pushOperators(
    pushGraphicsState(),
    setGraphicsState(gs),
    concatTransformationMatrix(W, 0, 0, H, 0, 0),
    // 1) branco
    pushGraphicsState(),
    PDFOperator.of(Ops.NonStrokingColorspace, [PDFName.of("CSWhite")]),
    PDFOperator.of(Ops.NonStrokingColorN, [PDFNumber.of(1)]),
    drawObject(whiteXo),
    popGraphicsState(),
    // 2) arte por cima, em sobreimpressão (mantém a chapa do branco intacta)
    drawObject(artXo),
    popGraphicsState(),
  );

  // sem "object streams": RIPs mais antigos leem melhor PDF 1.4 "plano"
  return doc.save({ useObjectStreams: false });
}
