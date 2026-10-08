/** The greeting's first message: a random opening line, then the time. */
export function formatMorningGreeting(greeting: string, clockTime: string): string {
  return `${greeting}Kello on <b>${clockTime}</b> & tämmöstä keliä ois sit tänää taas luvassa.`;
}

export const morningCallToAction = "Ja tästä päivä käyntiin!";

export const gamesJoinLine = "Liity mukaan SakariPelit kanavalla!";
