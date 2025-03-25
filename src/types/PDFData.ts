export interface OnboardingPDFData {
    organization_display_name: string;
    name: string;
    givenname: string;
    surname: string;
    templateReference: string;
}

export interface OnboardingData {
    pdf: string;
    png: string;
    link: string;
}
