import type { SurveyCategory } from '@/lib/survey-categories'

export type QuestionType = 'text' | 'scale' | 'heading'

export type TemplateQuestion = {
  text: string
  type: QuestionType
  category?: SurveyCategory
}

export type SurveyTemplate = {
  id: string
  label: string
  title: string
  questions: TemplateQuestion[]
  anonymous?: boolean
}

function heading(text: string): TemplateQuestion {
  return { text, type: 'heading' }
}

function text(text: string): TemplateQuestion {
  return { text, type: 'text' }
}

function scale(text: string, category?: SurveyCategory): TemplateQuestion {
  return { text, type: 'scale', category }
}

export const SURVEY_TEMPLATES: SurveyTemplate[] = [
  {
    id: 'fadder',
    label: 'Faddervurdering',
    title: 'Faddervurdering – Servitør',
    questions: [
      heading('Kjerneområder – ferdighet'),
      scale('Kundevennlighet'),
      scale('Salg og mersalg'),
      scale('Tempo og prioritering'),

      heading('Holdning – vektlagt (teller ekstra)'),
      scale('Tar tilbakemeldinger'),
      scale('Vilje til utvikling'),
      scale('Ansvar og initiativ'),

      heading('Støtteområder (teller ikke i snittet, men må være godkjent)'),
      scale('Kassehåndtering'),
      scale('Menykunnskap'),
      scale('Rydding og orden'),
      scale('Takeaway'),
      scale('Samarbeid'),
      scale('Helhetsvurdering (fadderens skjønn)'),

      heading('Oppsummering'),
      text('Tre styrker'),
      text('To til tre utviklingsmål (hva skal til for neste nivå)'),
      text('Konkrete neste steg og oppfølging'),
    ],
  },
  {
    id: 'egenvurdering-servitor',
    label: 'Egenvurdering servitør',
    title: 'Egenvurdering – Servitør',
    questions: [
      heading('Møtet med gjesten'),
      scale('Jeg er vennlig og imøtekommende mot gjestene'),
      scale('Jeg anbefaler og selger på en naturlig måte'),
      scale('Jeg jobber effektivt og prioriterer riktig når det er mye å gjøre'),

      heading('Holdning og utvikling (teller ekstra i snittet)'),
      scale('Jeg tar imot tilbakemeldinger og bruker dem til å bli bedre'),
      scale('Jeg har lyst til å lære mer og utvikle meg'),
      scale('Jeg tar ansvar og ser selv hva som må gjøres'),

      heading('Fag og samspill'),
      scale('Jeg kjenner menyen og kan svare gjestene om rettene'),
      scale('Jeg samarbeider godt med kollegaene mine'),
      scale('Jeg holder orden og rydder etter meg'),

      heading('Trivsel'),
      scale('Hvordan trives jeg på jobb totalt sett?', 'trivsel'),

      heading('Mine tanker'),
      text('Hva er jeg mest fornøyd med? (mine styrker)'),
      text('Hva vil jeg bli bedre på?'),
      text('Hva trenger jeg fra lederen min for å utvikle meg? (ønsker, mål, opplæring)'),
    ],
  },
  {
    id: 'egenvurdering-kokk',
    label: 'Egenvurdering kokk',
    title: 'Egenvurdering – Kokk',
    questions: [
      heading('Kvalitet'),
      scale('Følger jeg oppskrifter og porsjonsstørrelser konsekvent?'),
      scale('Er produktene mine visuelt presentable og i tråd med standard?'),
      scale('Sjekker jeg kvaliteten på råvarer før bruk?'),

      heading('IK-mat (internkontroll/HACCP) (teller ekstra)'),
      scale('Fører jeg temperaturlogger og sjekklister som avtalt?'),
      scale('Følger jeg regler for kjøling, oppbevaring og holdbarhet?'),
      scale('Er jeg bevisst på allergener og merking?'),
      scale('Vasker og desinfiserer jeg hender/utstyr riktig mellom oppgaver?'),

      heading('Renhold'),
      scale('Holder jeg arbeidsstasjonen ren gjennom hele skiftet?'),
      scale('Er stengerengjøring gjort iht. renholdsplan?'),
      scale('Rapporterer jeg mangler på utstyr/hygiene til vaktsjef?'),

      heading('Kommunikasjon'),
      scale('Sier jeg fra i tide ved forsinkelser eller problemer på kjøkkenet?'),
      scale('Kommuniserer jeg tydelig med servitører/kjøkken om ordre?'),
      scale('Tar jeg imot tilbakemeldinger konstruktivt?'),

      heading('Ryddighet'),
      scale('Er lager og kjølerom ryddig og lett å finne fram i?'),
      scale('Merker og daterer jeg varer riktig (FIFO)?'),
      scale('Rydder jeg utstyr og varer på riktig plass etter bruk?'),

      heading('Effektivitet og arbeidstempo'),
      scale('Klarer jeg leveringstider/tilberedningstider under press?'),
      scale('Prioriterer jeg riktig ved høy pågang?'),

      heading('Svinn og kostnadskontroll'),
      scale('Er jeg bevisst på å unngå unødvendig svinn?'),
      scale('Bruker jeg restevarer fornuftig?'),

      heading('Samarbeid'),
      scale('Hjelper jeg kollegaer når det er travelt?'),
      scale('Bidrar jeg til godt arbeidsmiljø på kjøkkenet?'),

      heading('Oppmøte og pålitelighet'),
      scale('Møter jeg presis og forberedt til skift?'),
      scale('Gir jeg beskjed i god tid ved fravær?'),

      heading('HMS og sikkerhet'),
      scale('Bruker jeg verneutstyr og følger sikkerhetsrutiner?'),
      scale('Melder jeg fra om farlige situasjoner/nestenulykker?'),

      heading('Trivsel'),
      scale('Hvordan trives jeg på jobb totalt sett?', 'trivsel'),

      heading('Mine tanker'),
      text('Hva er jeg mest fornøyd med? (mine styrker)'),
      text('Hva vil jeg bli bedre på?'),
      text('Hva trenger jeg fra lederen min for å utvikle meg? (ønsker, mål, opplæring)'),
    ],
  },
  {
    id: 'vaktsjef',
    label: 'Vaktsjefvurdering',
    title: 'Vaktsjefvurdering',
    questions: [
      heading('Kvalitet'),
      scale('Holder kvalitet og standard på mat, drikke og lokale'),
      scale('Følger hygiene, HMS og internkontroll'),
      scale('Fanger opp og retter feil før gjesten merker det'),

      heading('Service'),
      scale('Setter gjesten først og skaper god stemning'),
      scale('Driver mersalg og bygger en salgskultur'),
      scale('Håndterer klager og avvik på en god måte'),

      heading('System og drift'),
      scale('Styrer bemanning, pauser og flyt gjennom vakta'),
      scale('Følger rutiner for kasse, varemottak og oppgjør'),
      scale('Prioriterer og delegerer tydelig'),

      heading('Vaktsjef som forbilde (avgjørende – teller ekstra)'),
      scale('Går foran som et godt eksempel'),
      scale('Beholder roen og oversikten under press'),
      scale('Bygger laget og gir tilbakemelding'),
      scale('Er lojal mot beslutninger og husets verdier'),

      heading('Økonomi og resultat'),
      scale('Holder svinn og kostnader under kontroll'),
      scale('Styrer produktivitet – timebruk vs. omsetning'),
      scale('Jobber mot mål og følger opp tall'),
      scale('Tar økonomisk ansvar for vakta'),

      heading('Helhetsinntrykk'),
      scale('Hvor trygg er du på vaktsjefen i rollen totalt sett?'),

      heading('Oppsummering'),
      text('Største styrke'),
      text('Viktigste utviklingsområde'),
      text('Konkrete tiltak og mål framover'),
    ],
  },
  {
    id: 'trivsel',
    label: 'Trivselsundersøkelse',
    title: 'Trivselsundersøkelse',
    anonymous: true,
    questions: [
      scale('Jeg trives på jobb totalt sett', 'trivsel'),
      scale('Jeg føler meg inkludert og respektert av kollegaene mine', 'trivsel'),
      scale('Jeg gleder meg som regel til å gå på jobb', 'trivsel'),
      scale('Jeg får tydelige beskjeder og vet hva som forventes av meg', 'ledelse'),
      scale('Jeg blir sett og får tilbakemelding fra lederen min', 'ledelse'),
      scale('Jeg opplever at ledelsen tar tak i ting når noe ikke fungerer', 'ledelse'),
      scale('Arbeidsmengden min er til å håndtere', 'arbeidsforhold'),
      scale('Jeg har utstyret og opplæringen jeg trenger for å gjøre jobben', 'arbeidsforhold'),
      scale('Vaktene og turnusen fungerer greit for meg', 'arbeidsforhold'),
      text('Hva fungerer bra hos oss akkurat nå?'),
      text('Hva bør vi bli bedre på?'),
      text('Er det noe annet du vil si til ledelsen? (valgfritt)'),
    ],
  },
]
