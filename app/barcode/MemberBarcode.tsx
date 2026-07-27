"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

const MEMBER_ID_PATTERN = /^[0-9]+$/;

function toCodabarValue(memberId: string): string {
  return `A${memberId}A`;
}

export default function MemberBarcode({ memberId }: { memberId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isValid = MEMBER_ID_PATTERN.test(memberId);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isValid) return;
    try {
      JsBarcode(canvas, toCodabarValue(memberId), {
        format: "codabar",
        text: memberId.split("").join(" "),
        displayValue: true,
        font: "monospace",
        fontSize: 20,
        textMargin: 10,
        height: 90,
        width: 2,
        margin: 8,
        background: "#ffffff",
        lineColor: "#000000",
      });
    } catch (e) {
      console.error("barcode render failed", e);
    }
  }, [memberId, isValid]);

  function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png"); // PNG
    link.download = `会員証_${memberId}.png`;
    link.click();
  }

  if (!isValid) {
    return (
      <p className="text-center text-sm text-gray-500">
        会員番号の形式が正しくないため、バーコードを表示できません。
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <canvas ref={canvasRef} className="max-w-full" />
      <button type="button" onClick={handleSave} className="mt-6 text-sm text-gray-700 underline">
        画像を保存
      </button>
    </div>
  );
}