// import React from "react"; // Supprimé car non utilisé directement pour JSX ou React API
import { Toaster as SonnerPrimitive, type ToasterProps } from "sonner";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

type SonnerType = typeof SonnerPrimitive; // Renommé pour éviter le conflit avec le composant

const Sonner = ({ className, ...props }: React.ComponentProps<SonnerType>) => {
  const { theme = "system" } = useTheme();

  return (
    <SonnerPrimitive
      theme={theme as ToasterProps["theme"]}
      className={cn(
        "toaster group",
        className
      )}
      {...props}
    />
  );
};

export { Sonner };