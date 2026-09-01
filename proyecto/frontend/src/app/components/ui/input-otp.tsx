"use client";

import * as React from "react";
import { OTPInput, OTPInputContext } from "input-otp";
import { MinusIcon } from "lucide-react";

import { cn } from "./utils";

function InputOTP({
  className,
  containerClassName,
  ...props
}: React.ComponentProps<typeof OTPInput> & {
  containerClassName?: string;
}) {
  return (
    <OTPInput
      data-slot="input-otp"
      containerClassName={cn(
        "flex items-center gap-2 has-disabled:opacity-50",
        containerClassName,
      )}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  );
}

function InputOTPGroup({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn("flex items-center gap-1", className)}
      {...props}
    />
  );
}

function InputOTPSlot({
  index,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  index: number;
}) {
  const inputOTPContext = React.useContext(OTPInputContext);

  const { char, hasFakeCaret, isActive } =
    inputOTPContext?.slots[index] ?? {};

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      className={cn(
        // Base / inactive state
        "relative flex h-9 w-9 items-center justify-center",
        "border text-sm",
        "border-gray-300 dark:border-gray-600",
        "bg-input-background dark:bg-input/30",
        "transition-all duration-150",
        "outline-none",

        // Rounded corners
        "first:rounded-l-md first:border-l",
        "last:rounded-r-md",

        // Active state
        "data-[active=true]:z-10",
        "data-[active=true]:border-ring",
        "data-[active=true]:ring-ring/50",
        "data-[active=true]:ring-[3px]",

        // Invalid state
        "aria-invalid:border-destructive",
        "data-[active=true]:aria-invalid:ring-destructive/20",
        "dark:data-[active=true]:aria-invalid:ring-destructive/40",
        "data-[active=true]:aria-invalid:border-destructive",

        // Disabled
        "disabled:cursor-not-allowed",

        className,
      )}
      {...props}
    >
      {char}

      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="animate-caret-blink bg-foreground h-4 w-px duration-1000" />
        </div>
      )}
    </div>
  );
}

function InputOTPSeparator({
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-separator"
      role="separator"
      {...props}
    >
      <MinusIcon />
    </div>
  );
}

export {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
};