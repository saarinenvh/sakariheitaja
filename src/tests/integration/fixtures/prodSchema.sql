-- The bot's tables as prod's SHOW CREATE TABLE printed them on 2026-10-05, before the bot had
-- migrations. The integration tests create these, then the bot's own initialize() runs every
-- migration on top, as it does in prod. eagles and albatrosses have the same shape as aces.
-- When a migration changes a table, this file stays as it is: it is the starting point.

CREATE TABLE chats (
  id bigint(20) NOT NULL,
  name varchar(255) DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE players (
  id int(11) NOT NULL AUTO_INCREMENT,
  name varchar(255) NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE courses (
  id int(11) NOT NULL AUTO_INCREMENT,
  name varchar(255) DEFAULT NULL,
  nick_name varchar(255) DEFAULT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE competitions (
  id int(11) NOT NULL AUTO_INCREMENT,
  finished tinyint(1) DEFAULT NULL,
  chat_id bigint(20) DEFAULT NULL,
  metrix_id varchar(100) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY chat_id (chat_id),
  CONSTRAINT fk_competitions_chat_id FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE player_to_chat (
  id int(11) NOT NULL AUTO_INCREMENT,
  player_id int(11) NOT NULL,
  chat_id bigint(20) NOT NULL,
  PRIMARY KEY (id),
  KEY player_id (player_id),
  KEY chat_id (chat_id),
  CONSTRAINT chat_id FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE,
  CONSTRAINT player_id FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE scores (
  id int(11) NOT NULL AUTO_INCREMENT,
  player_id int(11) NOT NULL,
  chat_id bigint(20) NOT NULL,
  course_id int(11) NOT NULL,
  competition_id int(11) NOT NULL,
  diff int(11) NOT NULL,
  sum int(11) NOT NULL,
  PRIMARY KEY (id),
  KEY fk_scores_player_id (player_id),
  KEY fk_scores_chat_id (chat_id),
  KEY fk_scores_course_id (course_id),
  KEY fk_scores_competition_id (competition_id),
  CONSTRAINT fk_scores_chat_id FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE,
  CONSTRAINT fk_scores_competition_id FOREIGN KEY (competition_id) REFERENCES competitions (id) ON DELETE CASCADE,
  CONSTRAINT fk_scores_course_id FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE,
  CONSTRAINT fk_scores_player_id FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

CREATE TABLE aces (
  id int(11) NOT NULL AUTO_INCREMENT,
  date date NOT NULL,
  player_id int(11) NOT NULL,
  chat_id bigint(20) NOT NULL,
  course_id int(11) NOT NULL,
  competition_id int(11) NOT NULL,
  PRIMARY KEY (id),
  KEY fk_aces_player_id (player_id),
  KEY fk_aces_chat_id (chat_id),
  KEY fk_aces_course_id (course_id),
  KEY fk_aces_competition_id (competition_id),
  CONSTRAINT fk_aces_chat_id FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE,
  CONSTRAINT fk_aces_competition_id FOREIGN KEY (competition_id) REFERENCES competitions (id) ON DELETE CASCADE,
  CONSTRAINT fk_aces_course_id FOREIGN KEY (course_id) REFERENCES courses (id) ON DELETE CASCADE,
  CONSTRAINT fk_aces_player_id FOREIGN KEY (player_id) REFERENCES players (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- LIKE copies the columns and keys but not the foreign keys; prod's names differ anyway.
CREATE TABLE eagles LIKE aces;
CREATE TABLE albatrosses LIKE aces;
