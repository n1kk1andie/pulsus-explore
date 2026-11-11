// Line icons for Pulse. One stroke weight, round joins, currentColor — no fills,
// no emoji. Decorative by default (aria-hidden); give a `title` to make one
// meaningful to assistive technology.

import React from "react";

type P = { size?: number; title?: string; className?: string };
function Svg({ size = 20, title, className, children }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden={title ? undefined : true} role={title ? "img" : undefined} focusable="false">
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export const IPulse = (p: P) => <Svg {...p}><path d="M2.5 12h4l2.2-5.5 4.4 11 2.4-5.5h6" /></Svg>;
export const IDiagnosis = (p: P) => <Svg {...p}><circle cx="6" cy="5.5" r="2.2" /><circle cx="18" cy="12" r="2.2" /><circle cx="6" cy="18.5" r="2.2" /><path d="M8.2 6.4l7.6 4.3M8.2 17.6l7.6-4.3" /></Svg>;
export const ITreatment = (p: P) => <Svg {...p}><rect x="3.5" y="8.5" width="17" height="7" rx="3.5" transform="rotate(-45 12 12)" /><path d="M9.5 9.5l5 5" /></Svg>;
export const IRecovery = (p: P) => <Svg {...p}><path d="M3 17.5l5-5 3.5 3.5L20 7.5" /><path d="M15 7.5h5v5" /></Svg>;

export const IOperations = (p: P) => <Svg {...p}><path d="M4 6.5h10M4 12h16M4 17.5h7" /><path d="M16.5 4.5l2 2-2 2" /></Svg>;
export const IRisk = (p: P) => <Svg {...p}><path d="M12 3l7.5 3v5.5c0 4.4-3.1 7.6-7.5 9.5-4.4-1.9-7.5-5.1-7.5-9.5V6z" /></Svg>;
export const IPeople = (p: P) => <Svg {...p}><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19c.7-3 2.9-4.8 5.5-4.8s4.8 1.8 5.5 4.8" /><path d="M15.5 6a3 3 0 0 1 0 5.6M17.5 14.6c1.5.6 2.6 2.1 3 4.4" /></Svg>;
export const ITechnology = (p: P) => <Svg {...p}><rect x="3.5" y="4.5" width="17" height="11" rx="2" /><path d="M8.5 19.5h7M12 15.5v4" /></Svg>;
export const IStrategy = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" /></Svg>;

export const IHealthy = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M8.3 12.2l2.5 2.5 4.9-5" /></Svg>;
export const IWatch = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>;
export const IUnwell = (p: P) => <Svg {...p}><path d="M12 3.8l9 15.7H3z" /><path d="M12 10v4.2M12 17h.01" /></Svg>;

export const IUp = (p: P) => <Svg {...p}><path d="M7 17L17 7M9 7h8v8" /></Svg>;
export const IDown = (p: P) => <Svg {...p}><path d="M7 7l10 10M17 9v8H9" /></Svg>;
export const IFlat = (p: P) => <Svg {...p}><path d="M5 12h14M14 7l5 5-5 5" /></Svg>;
export const ICheck = (p: P) => <Svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;
export const IArrow = (p: P) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
export const IArrowDown = (p: P) => <Svg {...p}><path d="M12 5v14M6 13l6 6 6-6" /></Svg>;
export const ISun = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6L6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" /></Svg>;
export const IMoon = (p: P) => <Svg {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></Svg>;
export const IPlay = (p: P) => <Svg {...p}><path d="M8 5.5v13l10.5-6.5z" /></Svg>;
export const ISearch = (p: P) => <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></Svg>;
export const IStart = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 8v8M8 12h8" /></Svg>;
export const IFlag = (p: P) => <Svg {...p}><path d="M5 21V4M5 4.5h11l-2 4 2 4H5" /></Svg>;
export const IClose = (p: P) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>;
export const ILow = (p: P) => <Svg {...p}><path d="M3 7l6 6 4-4 8 8" /><path d="M21 12v5h-5" /></Svg>;
export const IInfo = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" /></Svg>;
export const ICompliance = (p: P) => <Svg {...p}><rect x="5" y="3.5" width="14" height="17" rx="2" /><path d="M9 3.5V5h6V3.5" /><path d="M8.8 12.6l2.2 2.2 4.2-4.3" /></Svg>;
export const IQuality = (p: P) => <Svg {...p}><circle cx="12" cy="9.5" r="5.5" /><path d="M9.8 9.6l1.6 1.6 2.9-3" /><path d="M8.6 14l-1.6 6.5 5-2.5 5 2.5-1.6-6.5" /></Svg>;
export const ILens = (p: P) => <Svg {...p}><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.3 15.3L20 20" /><path d="M7.5 10.5a3 3 0 0 1 3-3" /></Svg>;
export const IFormula = (p: P) => <Svg {...p}><path d="M16 4.5h-4.5c-1.2 0-2 .8-2.2 2L7.6 19.5" /><path d="M6 11h7" /><path d="M14 13.5l5 6M19 13.5l-5 6" /></Svg>;
export const IDatabase = (p: P) => <Svg {...p}><ellipse cx="12" cy="6" rx="7" ry="2.8" /><path d="M5 6v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6" /><path d="M5 12v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-6" /></Svg>;
export const IKey = (p: P) => <Svg {...p}><circle cx="8" cy="15" r="4" /><path d="M11 12l8.5-8.5M16 7l2.5 2.5M14 9l2 2" /></Svg>;
export const IUpload = (p: P) => <Svg {...p}><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5" /><path d="M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15" /></Svg>;
export const ICopy = (p: P) => <Svg {...p}><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" /></Svg>;
export const ITrash = (p: P) => <Svg {...p}><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5" /></Svg>;
export const IBroadcast = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="2" /><path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.3 5.3a9.5 9.5 0 0 0 0 13.4M18.7 5.3a9.5 9.5 0 0 1 0 13.4" /></Svg>;
export const IPayments = (p: P) => <Svg {...p}><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></Svg>;
export const ISettings = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" /><circle cx="12" cy="12" r="6.4" /></Svg>;
export const IPlug = (p: P) => <Svg {...p}><path d="M9 3.5v4M15 3.5v4" /><path d="M6.5 7.5h11v3.5a5.5 5.5 0 0 1-11 0z" /><path d="M12 16.5v4" /></Svg>;
export const IBuilding = (p: P) => <Svg {...p}><path d="M4.5 20.5v-15l7-2.5v17.5M11.5 8.5h8v12" /><path d="M3 20.5h18M7.5 8.5h1M7.5 12h1M7.5 15.5h1M14.5 12h2M14.5 15.5h2" /></Svg>;
export const ICard = (p: P) => <Svg {...p}><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></Svg>;
export const IPalette = (p: P) => <Svg {...p}><path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.9 1.4-1.9-.4-1 .2-2.1 1.3-2.1h2.1a3.7 3.7 0 0 0 3.7-3.7c0-5.1-3.8-9.3-8.5-9.3z" /><circle cx="7.8" cy="12" r="1" /><circle cx="10" cy="8" r="1" /><circle cx="14.5" cy="8" r="1" /></Svg>;
export const ICalibrate = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4" /></Svg>;
export const IGlobe = (p: P) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.2-3.5-8.5s1.1-6.1 3.5-8.5z" /></Svg>;
export const IHistory = (p: P) => <Svg {...p}><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><path d="M3.5 9.5h17M9 4.5v15M14.5 4.5v15" /></Svg>;
export const IReport = (p: P) => <Svg {...p}><path d="M6.5 3.5h8l4 4v13h-12z" /><path d="M14.5 3.5v4h4M9 12h6M9 15.5h6M9 9h2" /></Svg>;
export const IApps = (p: P) => <Svg {...p}><rect x="4" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" /></Svg>;
