const MAX_COURSE_NAME_LENGTH = 38;

/** A Metrix course name for a message: the layout arrow entity removed, cut to fit one line. */
export function truncateCourseName(rawName: string): string {
  const name = rawName.replace(/&rarr;/g, "");
  return name.length > MAX_COURSE_NAME_LENGTH ? `${name.slice(0, MAX_COURSE_NAME_LENGTH - 1)}...` : name;
}
