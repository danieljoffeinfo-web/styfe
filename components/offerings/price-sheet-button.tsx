"use client";

import * as React from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function PriceSheetButton({ text }: { text: string }) {
  const toast = useToast();

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast("Price sheet copied. Paste it into WhatsApp or email.");
    } catch {
      toast("Could not reach the clipboard. Select the text and copy it by hand.", "error");
    }
  }

  return (
    <Button onClick={copy}>
      <Copy /> Copy price sheet
    </Button>
  );
}
