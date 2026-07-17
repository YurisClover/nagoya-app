"use client" // client --resize + upload

import { useState, useRef, useTransition } from "react";
import { updateBarcodeAction } from "./actions";

const MAX_WIDTH = 600;

export default function BarcodeUploader () {
    const [preview, setPreview] = useState("");
    const [error, setError] = useState("");
    const  [isPending, startTransitional] = useTransition();
    const fileRef = useRef<HTMLInputElement>(null);

    async function handleFile(e: React.ChangeEvent<HTMLInputElement>){
        setError("");
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            setError("画像を選択してください");
        } 

        // read image
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, MAX_WIDTH / bitmap.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        const ctx = canvas.getContext("2d");
        if(!ctx) {setError("処理に失敗しました"); return;}
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); // draw smaller
        const dataUrl = canvas.toDataURL("image/png"); // Base64 sharp PNG

        if(dataUrl.length > 50000) {
            setError("画像のサイズが大きすぎます");
            return ;
        }
        setPreview(dataUrl);
    }

    function handleSave() {
        if(!preview) return;
        startTransitional(async () => {
            try {
                await updateBarcodeAction(preview); // call server action
                setPreview("");
                if(fileRef.current) fileRef.current.value = "";
            } catch {setError("保存に失敗しました")}
        });
    }
    return (
    <div style={{ marginTop: 24}}>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} />
        {error && <p style= {{color: "crimson", fontSize: 13}}>{error}</p>}
        {preview && (
            <div style={{marginTop: 12}}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="プレビュー" style={{width: "100%", border: "1px dashed #ccc", padding: 8}}/>
                <button onClick={handleSave} disabled={isPending} style={{marginTop: 8, padding: "8px 16px"}}>
                    {isPending ? "保存中..." : "バーコードを更新"}
                </button>
            </div>
        )}
    </div>
    );
}