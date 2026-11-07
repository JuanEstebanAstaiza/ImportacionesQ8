import { useBrandTheme } from "@/hooks/useBrandTheme";

export function Logo() {
  const { dark } = useBrandTheme();
  return <div className="flex items-center overflow-hidden">
    <img src={dark ? "/brand/zarpi-wordmark-acid.svg" : "/brand/zarpi-wordmark.svg"} alt="Zarpi" className="h-8 w-28 object-contain object-left" />
  </div>;
}
