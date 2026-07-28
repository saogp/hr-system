export type SurveyTemplate = {
  id: string
  label: string
  title: string
  questions: string[]
}

export const SURVEY_TEMPLATES: SurveyTemplate[] = [
  {
    id: 'fadder',
    label: 'Faddervurdering',
    title: 'Faddervurdering',
    questions: [
      'Hvordan opplever du at den nyansatte har tilpasset seg arbeidsmiljøet?',
      'Hvordan er den nyansattes faglige utvikling så langt?',
      'Er det noe den nyansatte trenger mer opplæring i?',
      'Hvordan er samarbeidet og kommunikasjonen med den nyansatte?',
      'Har du noen anbefalinger for videre oppfølging?',
    ],
  },
  {
    id: 'egenvurdering-servitor',
    label: 'Egenvurdering servitør',
    title: 'Egenvurdering servitør',
    questions: [
      'Hvordan vurderer du din egen kundeservice?',
      'Hvor komfortabel er du med menyen og det å anbefale rett eller drikke?',
      'Hvordan håndterer du stressede perioder og rush?',
      'Hva fungerer bra i samarbeidet med kjøkkenet?',
      'Hva kunne du tenke deg å bli bedre på?',
    ],
  },
  {
    id: 'egenvurdering-kokk',
    label: 'Egenvurdering kokk',
    title: 'Egenvurdering kokk',
    questions: [
      'Hvordan vurderer du din arbeidsflyt på stasjonen din?',
      'Hvor godt følger du oppskrifter og standarder for presentasjon?',
      'Hvordan er din forståelse av hygiene og HACCP-rutiner?',
      'Hvordan fungerer samarbeidet med resten av kjøkkenet?',
      'Hva ønsker du å utvikle deg videre innen?',
    ],
  },
  {
    id: 'vaktsjef',
    label: 'Vaktsjefvurdering',
    title: 'Vaktsjefvurdering',
    questions: [
      'Hvordan vurderer du din evne til å lede vakten og fordele oppgaver?',
      'Hvordan håndterer du uforutsette situasjoner i løpet av vakten?',
      'Hvordan er kommunikasjonen med de ansatte du har ansvar for?',
      'Hvordan følger du opp rutiner for åpning/stenging og internkontroll?',
      'Hva kunne du tenke deg mer støtte eller opplæring i?',
    ],
  },
]
