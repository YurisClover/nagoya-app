"user server"; // every export in this file = server action

import { auth } from "@/auth";
import { updateUserBarcode } from "@/lib/sheets";
import { revalidatePath } from "next/cache";

export async function updateBarcodeAction(dataUrl: string) {
    // user auth
    const session = await auth();
    if (!session?.user?.email) throw new Error ("unauthrorized");
    // image auth
    if (!dataUrl.startsWith("data:/image")) throw new Error ("invalid image");
    if (dataUrl.length > 50000) throw new Error ("image are too large");

    await updateUserBarcode(session.user.email, dataUrl); // email from session
    revalidatePath("/barcode");
}