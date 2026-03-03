import type { ComponentType } from "react";
import type { Platform } from "@/parsers/types";
import {
  WhatsAppIcon,
  InstagramIcon,
  TikTokIcon,
  XIcon,
  GoogleIcon,
  TelegramIcon,
  GarminIcon,
  SpotifyIcon,
} from "@/components/icons/platform-icons";

export interface PlatformMeta {
  name: string;
  icon: ComponentType<{ className?: string; style?: React.CSSProperties }>;
  colorClass: string;
  cssVar: string;
  signalLevel: 1 | 2 | 3 | 4 | 5;
  helpUrl: string;
}

export const PLATFORM_META: Record<Platform, PlatformMeta> = {
  whatsapp: {
    name: "WhatsApp",
    icon: WhatsAppIcon,
    colorClass: "text-whatsapp",
    cssVar: "--platform-whatsapp",
    signalLevel: 2,
    helpUrl: "https://faq.whatsapp.com/526463418847093",
  },
  instagram: {
    name: "Instagram",
    icon: InstagramIcon,
    colorClass: "text-instagram",
    cssVar: "--platform-instagram",
    signalLevel: 3,
    helpUrl: "https://help.instagram.com/181231772500920",
  },
  tiktok: {
    name: "TikTok",
    icon: TikTokIcon,
    colorClass: "text-tiktok",
    cssVar: "--platform-tiktok",
    signalLevel: 4,
    helpUrl: "https://support.tiktok.com/en/account-and-privacy/personalized-ads-and-data/requesting-your-data",
  },
  twitter: {
    name: "X",
    icon: XIcon,
    colorClass: "text-twitter",
    cssVar: "--platform-twitter",
    signalLevel: 4,
    helpUrl: "https://help.x.com/en/managing-your-account/how-to-download-your-x-archive",
  },
  google: {
    name: "Google",
    icon: GoogleIcon,
    colorClass: "text-google",
    cssVar: "--platform-google",
    signalLevel: 5,
    helpUrl: "https://support.google.com/accounts/answer/3024190",
  },
  telegram: {
    name: "Telegram",
    icon: TelegramIcon,
    colorClass: "text-telegram",
    cssVar: "--platform-telegram",
    signalLevel: 3,
    helpUrl: "https://telegram.org/blog/export-and-more",
  },
  garmin: {
    name: "Garmin",
    icon: GarminIcon,
    colorClass: "text-garmin",
    cssVar: "--platform-garmin",
    signalLevel: 2,
    helpUrl: "https://www.garmin.com/en-US/account/datamanagement/",
  },
  spotify: {
    name: "Spotify",
    icon: SpotifyIcon,
    colorClass: "text-spotify",
    cssVar: "--platform-spotify",
    signalLevel: 5,
    helpUrl: "https://support.spotify.com/us/article/data-rights-and-privacy-settings/",
  },
};
