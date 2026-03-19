import React, { useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";

interface OTPInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
}

export function OTPInput({ value, onChange, length = 6 }: OTPInputProps) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const handleChange = (index: number, val: string) => {
    // Only allow digits
    const digit = val.replace(/\D/g, "");
    if (digit.length > 1) return;

    const newValue = value.split("");
    newValue[index] = digit;
    const result = newValue.slice(0, length).join("");
    onChange(result);

    // Auto-focus next input
    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text");
    const digits = pastedData.replace(/\D/g, "").slice(0, length);
    onChange(digits);
    
    // Focus last input
    if (digits.length > 0) {
      setTimeout(() => {
        inputRefs.current[Math.min(digits.length, length - 1)]?.focus();
      }, 0);
    }
  };

  return (
    <div className="flex justify-center gap-2" onPaste={handlePaste}>
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[index] || ""}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          className="w-12 h-12 text-center text-2xl font-bold border-2 border-input rounded-md focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary focus:ring-offset-2 bg-background"
        />
      ))}
    </div>
  );
}
