export type QuestionType = 'text' | 'scale'

export type TemplateQuestion = {
  text: string
  type: QuestionType
}

export type SurveyTemplate = {
  id: string
  label: string
  title: string
  questions: TemplateQuestion[]
  anonymous?: boolean
}

function text(text: string): TemplateQuestion {
  return { text, type: 'text' }
}

function scale(text: string): TemplateQuestion {
  return { text, type: 'scale' }
}

export const SURVEY_TEMPLATES: SurveyTemplate[] = [
  {
    id: 'fadder',
    label: 'Faddervurdering',
    title: 'Faddervurdering',
    questions: [
      text('Hvordan opplever du at den nyansatte har tilpasset seg arbeidsmiljøet?'),
      text('Hvordan er den nyansattes faglige utvikling så langt?'),
      text('Er det noe den nyansatte trenger mer opplæring i?'),
      text('Hvordan er samarbeidet og kommunikasjonen med den nyansatte?'),
      text('Har du noen anbefalinger for videre oppfølging?'),
    ],
  },
  {
    id: 'egenvurdering-servitor',
    label: 'Egenvurdering servitør',
    title: 'Egenvurdering servitør',
    questions: [
      text('Hvordan vurderer du din egen kundeservice?'),
      text('Hvor komfortabel er du med menyen og det å anbefale rett eller drikke?'),
      text('Hvordan håndterer du stressede perioder og rush?'),
      text('Hva fungerer bra i samarbeidet med kjøkkenet?'),
      text('Hva kunne du tenke deg å bli bedre på?'),
    ],
  },
  {
    id: 'egenvurdering-kokk',
    label: 'Egenvurdering kokk',
    title: 'Egenvurdering kokk',
    questions: [
      text('Hvordan vurderer du din arbeidsflyt på stasjonen din?'),
      text('Hvor godt følger du oppskrifter og standarder for presentasjon?'),
      text('Hvordan er din forståelse av hygiene og HACCP-rutiner?'),
      text('Hvordan fungerer samarbeidet med resten av kjøkkenet?'),
      text('Hva ønsker du å utvikle deg videre innen?'),
    ],
  },
  {
    id: 'vaktsjef',
    label: 'Vaktsjefvurdering',
    title: 'Vaktsjefvurdering',
    questions: [
      text('Hvordan vurderer du din evne til å lede vakten og fordele oppgaver?'),
      text('Hvordan håndterer du uforutsette situasjoner i løpet av vakten?'),
      text('Hvordan er kommunikasjonen med de ansatte du har ansvar for?'),
      text('Hvordan følger du opp rutiner for åpning/stenging og internkontroll?'),
      text('Hva kunne du tenke deg mer støtte eller opplæring i?'),
    ],
  },
  {
    id: 'trivsel',
    label: 'Trivselsundersøkelse',
    title: 'Trivselsundersøkelse',
    anonymous: true,
    questions: [
      scale('Jeg trives på jobb totalt sett'),
      scale('Jeg føler meg inkludert og respektert av kollegaene mine'),
      scale('Jeg gleder meg som regel til å gå på jobb'),
      scale('Jeg får tydelige beskjeder og vet hva som forventes av meg'),
      scale('Jeg blir sett og får tilbakemelding fra lederen min'),
      scale('Jeg opplever at ledelsen tar tak i ting når noe ikke fungerer'),
      scale('Arbeidsmengden min er til å håndtere'),
      scale('Jeg har utstyret og opplæringen jeg trenger for å gjøre jobben'),
      scale('Vaktene og turnusen fungerer greit for meg'),
      text('Hva fungerer bra hos oss akkurat nå?'),
      text('Hva bør vi bli bedre på?'),
      text('Er det noe annet du vil si til ledelsen? (valgfritt)'),
    ],
  },
]
