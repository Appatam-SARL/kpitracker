export interface EmailComposeTemplate {
  id: string;
  label: string;
  subject?: string;
  /** Fragment HTML inséré dans l’éditeur TipTap */
  html: string;
}

export const EMAIL_COMPOSE_TEMPLATES: EmailComposeTemplate[] = [
  {
    id: "relance",
    label: "Relance simple",
    subject: "Suite à notre échange",
    html: "<p>Bonjour,</p><p>Je me permets de revenir vers vous suite à notre dernier échange. N’hésitez pas à me dire si vous souhaitez que nous fixions un créneau pour en discuter.</p>",
  },
  {
    id: "proposition",
    label: "Envoi de proposition",
    subject: "Votre proposition commerciale",
    html: "<p>Bonjour,</p><p>Comme convenu, vous trouverez ci-dessous les éléments de notre proposition. Je reste à votre disposition pour toute question.</p>",
  },
  {
    id: "rdv",
    label: "Prise de rendez-vous",
    subject: "Proposition de rendez-vous",
    html: "<p>Bonjour,</p><p>Seriez-vous disponible pour un court échange téléphonique ou visio ? Voici quelques créneaux qui pourraient nous convenir :</p><ul><li></li><li></li></ul>",
  },
  {
    id: "remerciement",
    label: "Remerciement",
    subject: "Merci pour votre temps",
    html: "<p>Bonjour,</p><p>Je tenais à vous remercier pour le temps accordé lors de notre échange. Je reviens vers vous très prochainement.</p>",
  },
];
