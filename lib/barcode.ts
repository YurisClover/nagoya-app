import "server-only";
import bwipjs from "bwip-js/node";

// generate member_id -> barcode (NW-7 start and stop with 'A')
export async function generateMemberBarcode(memberId: string): Promise<string> {
  const text = `A${memberId}A`;
  const png = await bwipjs.toBuffer({
    bcid: "rationalizedCodabar", // NW-7
    text,
    scale: 3,
    height: 12,
    includetext: true, // show number on barcode
    textxalign: "center",
    backgroundcolor: "FFFFFF",
    paddingwidth: 10,
    paddingheight: 6,
  });
  return `data:image/png;base64,${png.toString("base64")}`;
}