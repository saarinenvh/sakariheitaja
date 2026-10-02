export const weatherEmojis: Record<string, string> = {
  Clouds: "\u{2601}",
  Clear: "\u{2600}",
  Rain: "\u{2614}",
  Snow: "\u{2744}",
  Drizzle: "\u{2614}",
};

/** Finnish towns for /randomsaa and the morning weather. */
export const cities = [
  "Akaa", "Alajärvi", "Alavus", "Espoo", "Forssa", "Haapajärvi", "Haapavesi",
  "Hamina", "Hanko", "Harjavalta", "Heinola", "Helsinki", "Huittinen",
  "Hyvinkää", "Hämeenlinna", "Iisalmi", "Ikaalinen", "Imatra", "Joensuu",
  "Jyväskylä", "Jämsä", "Järvenpää", "Kaarina", "Kajaani", "Kalajoki",
  "Kangasala", "Kankaanpää", "Kannus", "Karkkila", "Kaskinen", "Kauhajoki",
  "Kauhava", "Kauniainen", "Kemi", "Kemijärvi", "Kerava", "Keuruu", "Kitee",
  "Kiuruvesi", "Kokemäki", "Kokkola", "Kotka", "Kouvola", "Kristiinankaupunki",
  "Kuhmo", "Kuopio", "Kurikka", "Kuusamo", "Lahti", "Laitila", "Lappeenranta",
  "Lapua", "Lieksa", "Lohja", "Loimaa", "Loviisa", "Maarianhamina", "Mikkeli",
  "Mänttä-Vilppula", "Naantali", "Nivala", "Nokia", "Nurmes", "Närpiö",
  "Orimattila", "Orivesi", "Oulainen", "Oulu", "Outokumpu", "Paimio",
  "Parainen", "Parkano", "Pieksämäki", "Pietarsaari", "Pori", "Porvoo",
  "Pudasjärvi", "Pyhäjärvi", "Raahe", "Raasepori", "Raisio", "Rauma",
  "Riihimäki", "Rovaniemi", "Saarijärvi", "Salo", "Sastamala", "Savonlinna",
  "Seinäjoki", "Somero", "Suonenjoki", "Tampere", "Tornio", "Turku",
  "Ulvila", "Uusikaarlepyy", "Uusikaupunki", "Vaasa", "Valkeakoski", "Vantaa",
];

export const cityNotFound = (city: string): string => `Mikä vitun ${city}? - Eihän tommosta mestaa oo ees olemassakaa.`;
