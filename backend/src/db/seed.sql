-- Kupot Project — Seed Data
-- Run after schema.sql

-- ─────────────────────────────────────────
--  SETTINGS
-- ─────────────────────────────────────────
INSERT INTO settings (key, value) VALUES
  ('alert_days_global', '30')
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────
--  BOX TYPES
-- ─────────────────────────────────────────
INSERT INTO box_types (name) VALUES
  ('גדולה'),
  ('רגילה'),
  ('קטנה')
ON CONFLICT (name) DO NOTHING;

-- ─────────────────────────────────────────
--  TASK TYPES
-- ─────────────────────────────────────────
INSERT INTO task_types (name, icon, opens_card, closes_card, grants_temporary_access) VALUES
  ('התקנה',        '🔧', TRUE,  FALSE, FALSE),
  ('הסרה',         '🗑️', FALSE, TRUE,  FALSE),
  ('העברת מיקום',  '🔄', TRUE,  TRUE,  FALSE),
  ('החלפת מנעול',  '🔑', FALSE, FALSE, FALSE),
  ('תיקון',        '🛠️', FALSE, FALSE, FALSE),
  ('צביעה',        '🎨', FALSE, FALSE, FALSE),
  ('שיפוץ',        '🏗️', FALSE, FALSE, FALSE),
  ('גביה',         '💰', FALSE, FALSE, TRUE)
ON CONFLICT (name) DO NOTHING;

-- ─────────────────────────────────────────
--  REPORT TYPES
-- ─────────────────────────────────────────
INSERT INTO report_types (name, icon) VALUES
  ('תקלה טכנית',   '🔧'),
  ('גנבה/פריצה',   '🚨'),
  ('נזק',          '💥'),
  ('אחר',          '📝')
ON CONFLICT (name) DO NOTHING;

-- Users are seeded by scripts/seedUsers.js (real bcrypt hashes).
-- Run `npm run db:seed` to seed users first, then this file.

-- ─────────────────────────────────────────
--  BOXES (20 boxes)
-- ─────────────────────────────────────────
INSERT INTO boxes (iron_number, box_type_id, status) VALUES
  ('1001', 1, 'active'),
  ('1002', 2, 'active'),
  ('1003', 2, 'active'),
  ('1004', 3, 'active'),
  ('1005', 1, 'active'),
  ('1006', 2, 'active'),
  ('1007', 3, 'active'),
  ('1008', 2, 'active'),
  ('1009', 1, 'active'),
  ('1010', 2, 'active'),
  ('1011', 2, 'active'),
  ('1012', 3, 'active'),
  ('1013', 1, 'active'),
  ('1014', 2, 'active'),
  ('1015', 3, 'active'),
  ('1016', 2, 'inactive'),
  ('1017', 2, 'inactive'),
  ('1018', 3, 'uninstalled'),
  ('1019', 1, 'uninstalled'),
  ('1020', 2, 'uninstalled')
ON CONFLICT (iron_number) DO NOTHING;

-- ─────────────────────────────────────────
--  CARDS — for active boxes
--  We open a card per active box
-- ─────────────────────────────────────────
DO $$
DECLARE
  v_box_id   INTEGER;
  v_coll_id  INTEGER;
  cities     TEXT[] := ARRAY['בני ברק','בני ברק','בני ברק','בני ברק','בני ברק',
                              'ירושלים','ירושלים','ירושלים','ירושלים','ירושלים',
                              'אשדוד','אשדוד','אשדוד','אשדוד','אשדוד'];
  hoods      TEXT[] := ARRAY['רמת אלחנן','פועלי אגודת ישראל','ויזניץ','הקהילות','מרכז העיר',
                              'מאה שערים','גאולה','רמות','בית ישראל','רחביה',
                              'ד','ה','ו','ז','ח'];
  streets    TEXT[] := ARRAY['רב''י עקיבא','חזון איש','ביאליק','שמחה','הרב ניסים',
                              'מאה שערים','שבטי ישראל','הרב צבי','שמואל הנביא','רמב''ן',
                              'הרצל','שד'' בן גוריון','רוטשילד','ורדים','צבי'];
  iron_nums  TEXT[] := ARRAY['1001','1002','1003','1004','1005','1006','1007','1008',
                              '1009','1010','1011','1012','1013','1014','1015'];
  collector_ids INTEGER[];
  i INTEGER;
BEGIN
  -- get collector user ids in order
  SELECT ARRAY(
    SELECT id FROM users WHERE role = 'collector' ORDER BY id
  ) INTO collector_ids;

  FOR i IN 1..15 LOOP
    SELECT id INTO v_box_id FROM boxes WHERE iron_number = iron_nums[i];
    v_coll_id := collector_ids[((i-1) % array_length(collector_ids,1)) + 1];

    INSERT INTO cards (box_id, city, neighborhood, street, building, collector_id, status, opened_at)
    VALUES (
      v_box_id,
      cities[i],
      hoods[i],
      streets[i],
      TO_CHAR(i * 3, 'FM99'),
      v_coll_id,
      'active',
      NOW() - (random() * INTERVAL '365 days')
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- ─────────────────────────────────────────
--  ENVELOPES — sample collection history
-- ─────────────────────────────────────────
DO $$
DECLARE
  v_card_id  INTEGER;
  v_coll_id  INTEGER;
  v_env_num  TEXT;
  i INTEGER;
  j INTEGER;
  env_counter INTEGER := 1000;
BEGIN
  FOR i IN 1..10 LOOP
    SELECT c.id, c.collector_id INTO v_card_id, v_coll_id
    FROM cards c WHERE c.status = 'active' ORDER BY c.id LIMIT 1 OFFSET (i-1);

    FOR j IN 1..3 LOOP
      env_counter := env_counter + 1;
      v_env_num := 'ENV-' || env_counter;
      INSERT INTO envelopes (card_id, envelope_number, collected_at, collected_by, amount, status, entered_at, entered_by)
      VALUES (
        v_card_id,
        v_env_num,
        NOW() - (j * INTERVAL '30 days') - (random() * INTERVAL '5 days'),
        v_coll_id,
        ROUND((random() * 500 + 50)::NUMERIC, 2),
        'entered',
        NOW() - (j * INTERVAL '29 days'),
        (SELECT id FROM users WHERE role = 'cashroom' LIMIT 1)
      )
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;

  -- a few pending (not yet entered)
  FOR i IN 11..15 LOOP
    SELECT c.id, c.collector_id INTO v_card_id, v_coll_id
    FROM cards c WHERE c.status = 'active' ORDER BY c.id LIMIT 1 OFFSET (i-1);

    env_counter := env_counter + 1;
    v_env_num := 'ENV-' || env_counter;
    INSERT INTO envelopes (card_id, envelope_number, collected_at, collected_by, status)
    VALUES (
      v_card_id,
      v_env_num,
      NOW() - (random() * INTERVAL '3 days'),
      v_coll_id,
      'pending'
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- ─────────────────────────────────────────
--  EVENTS — installation event per card
-- ─────────────────────────────────────────
INSERT INTO events (card_id, event_type, description, user_id, created_at)
SELECT
  c.id,
  'installation',
  'התקנת קופה ראשונית',
  (SELECT id FROM users WHERE role = 'admin' LIMIT 1),
  c.opened_at
FROM cards c;

-- collection events matching envelopes
INSERT INTO events (card_id, event_type, description, user_id, created_at)
SELECT
  e.card_id,
  'collection',
  'גביה — מעטפה ' || e.envelope_number,
  e.collected_by,
  e.collected_at
FROM envelopes e;
