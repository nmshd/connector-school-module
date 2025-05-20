export interface PDFSettings {
    logo?: PDFLogoSettings;
    fields?: Record<string, string>;
}

export interface PDFLogoSettings {
    bytes?: string;
    x?: number;
    y?: number;
    maxWidth?: number;
    maxHeight?: number;
}
