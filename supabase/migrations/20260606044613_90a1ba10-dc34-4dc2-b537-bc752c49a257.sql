
-- Enum for entry type
DO $$ BEGIN
  CREATE TYPE public.directory_entry_type AS ENUM ('association', 'corporate');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table
CREATE TABLE public.directory_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type public.directory_entry_type NOT NULL DEFAULT 'corporate',
  slug text NOT NULL UNIQUE,
  company_name text NOT NULL,
  short_description text,
  long_description text,
  mission text,
  vision text,
  services text[] NOT NULL DEFAULT '{}',
  products text[] NOT NULL DEFAULT '{}',
  executives jsonb NOT NULL DEFAULT '[]'::jsonb,
  director_name text,
  contact_name text,
  phone text,
  email text,
  website text,
  physical_address text,
  postal_address text,
  country text NOT NULL DEFAULT 'Ghana',
  region text,
  logo_url text,
  cover_image_url text,
  category text,
  featured boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.directory_entries TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.directory_entries TO authenticated;
GRANT ALL ON public.directory_entries TO service_role;

ALTER TABLE public.directory_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published directory entries"
  ON public.directory_entries FOR SELECT
  USING (published = true);

CREATE POLICY "Admins view all directory entries"
  ON public.directory_entries FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage directory entries"
  ON public.directory_entries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_directory_entries_updated_at
  BEFORE UPDATE ON public.directory_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX directory_entries_type_idx ON public.directory_entries(entry_type);
CREATE INDEX directory_entries_published_idx ON public.directory_entries(published);

-- Seed: Associations
INSERT INTO public.directory_entries (entry_type, slug, company_name, short_description, mission, vision, services, products, executives, contact_name, phone, email, physical_address, postal_address, category, featured, display_order) VALUES
('association', 'speg', 'SPEG — Sea-Freight Pineapple Exporters of Ghana',
 'A group of all the major pineapple and other fruits producers and exporters in Ghana, exporting to Europe, the Middle East, Eastern Europe and North Africa.',
 'To bring together operators in the pineapple and fruit industry and promote good agricultural practices and provide efficient, effective and economic logistical services.',
 'To be nationally and globally recognized as a premier center for unifying pineapple and other fruits exporters for shipment, shaping policy and providing relevant services to the fruit industry.',
 ARRAY['Shipping arrangement for members','Joint marketing in the EU, Middle East and beyond','Quality control and GlobalGAP certification support'],
 ARRAY['Fresh Pineapples: MD2, Smooth Cayenne, Queen Victoria, Sugarloaf','Dried Fruits — Pineapples, Mangoes, Coconuts & Papaya'],
 '[{"role":"President","name":"Solomon Armah Benjamin"},{"role":"Vice President","name":"Daniel Kojo Asherow"},{"role":"Treasurer","name":"Emmanuel Boadi Koranteng"}]'::jsonb,
 'Mr. Stephen Mintah (General Manager)', '+233 (0) 24 604 7344 / +233 (0) 24 425 0653', NULL,
 '1st Floor Ampomaah House, Olusegun Obasanjo Way — Roman Ridge', NULL, 'Pineapples & Fruits', true, 1),
('association', 'grocteu', 'GROCTEU — Ghana Root Crops and Tubers Exporters Union',
 'Apex body for yam, sweet potato and cocoyam exporters; manages the National Yam Packhouse in Tema.',
 NULL, NULL,
 ARRAY['Workshops and seminars on international best practices','Market intelligence and tradeshow participation','Policy advocacy for members'],
 ARRAY['Yams','Sweet Potatoes','Cocoyams'],
 '[{"role":"President","name":"Mr. Osei Sarkodie"}]'::jsonb,
 'Mr. Kwabena Taylor & Mr. Osei Sarkodie', '+233 (0) 20 202 9966', 'info@grocteu.com',
 '2nd Floor, Ghana Highways Authority Building, Accra', 'P.O. Box T599 Tema, Ghana', 'Roots & Tubers', true, 2),
('association', 'gavex', 'GAVEX — Ghana Association of Vegetable Exporters',
 'Top exporters of Asian and African vegetables from Ghana, establishing Ghana as a vegetable producer and exporter known for quality.',
 NULL, NULL,
 ARRAY['Quality improvement through sensitisation and training','Group participation in local and international exhibitions','Advocacy for favourable export conditions'],
 ARRAY['Asian Vegetables','African Vegetables','Cassava','Okra','Green Chillies'],
 '[{"role":"President","name":"Mr. Collins Hodey"}]'::jsonb,
 'Mr. Collins Hodey', '+233 (0) 24 675 8095', 'gavexghana@gmail.com',
 NULL, 'P.O. Box T653, Cantonments — Accra, Ghana', 'Vegetables', true, 3),
('association', 'vepeag', 'VEPEAG — Vegetable Producers & Exporters Association of Ghana',
 'Established in October 1997 by individual farmers and exporters; over 400 members across seven regions of Ghana.',
 NULL, NULL,
 ARRAY['Technical services in site selection, land preparation, nursery, planting, pest and disease control, farm management','Training and seminars on quality, packaging, standards, records, business management','Marketing information for fresh vegetables','Negotiation support for local and international markets','Business advisory services'],
 ARRAY['Sweet Potatoes','Okra','Chillies','Shallots'],
 '[{"role":"President","name":"Mr. Felix Mawuli Kamassah"},{"role":"Vice President","name":"Kuma-Koranteng Darkwa"},{"role":"Secretary","name":"Christine Esinam Atange"},{"role":"Treasurer","name":"Samuel Gyan"}]'::jsonb,
 'Mr. Daniel Normanyo (Office Manager)', '+233 (0) 24 375 3610', 'vepeag@gmail.com',
 'Agric Mechanization, Burma Camp, Accra', 'P.O. Box SD 239 — Accra, Ghana', 'Vegetables', true, 4),
('association', 'yilo-krobo-mango', 'Yilo Krobo Mango Farmers Association',
 'Established in February 2005 to promote the interest of mango producers in the Yilo Krobo District of Eastern Region. Over 300 members with 100+ Global GAP certified and a combined acreage of 5000+ acres.',
 NULL, NULL,
 ARRAY['Group marketing and contracts with large off-takers and processors','Training in good agricultural practices and new technologies','Advocacy on behalf of members'],
 ARRAY['Keitt Mango','Kent Mango','Tommy Atkins Mango'],
 '[{"role":"President","name":"Mr. Jonathan Adabang"},{"role":"Vice President","name":"Mr. John Narh Sackey"},{"role":"Secretary","name":"Mr. John Kofi Takpo"}]'::jsonb,
 'Mr. John Kofi Takpo', '+233 (0) 24 411 7549', 'yilomangos2005@yahoo.com',
 NULL, 'P.O. Box SA 356 Somanya, Eastern Region, Ghana', 'Mangoes', true, 5),
('association', 'coconut-federation-ghana', 'Coconut Federation, Ghana (CocoFeG)',
 'National organisation representing stakeholders across the coconut value chain — nursery operators, farmers, processors, exporters, aggregators and vendors.',
 'To foster the growth of a robust and sustainable coconut sector in Ghana, providing employment, innovation and livelihood opportunities while ensuring environmental stewardship.',
 'To position Ghana as a leading producer and exporter of high-quality coconuts and coconut-derived products in Africa and globally.',
 ARRAY['Capacity building and training','Policy advocacy','Market expansion','Youth and women empowerment','Sustainability initiatives'],
 ARRAY['Fresh Coconuts','Coconut-derived products'],
 '[]'::jsonb,
 'Mr. Kwaku Boateng', '+233 (0) 24 604 7344 / +233 (0) 24 425 0653', 'coconutfederationghana@gmail.com',
 'AESL Building, 2nd Floor', NULL, 'Coconut', true, 6);

-- Seed: Corporate Members
INSERT INTO public.directory_entries (entry_type, slug, company_name, director_name, products, phone, email, physical_address, category, display_order) VALUES
('corporate', 'mount-sunset-farms', 'Mount Sunset Farms', 'Mrs. Florence Darlington Kudzo', ARRAY['Mangoes','Coconut','Honey'], '+233 (0) 244 892 351 / +233 (0) 244 892 871', 'perfectsunset77@gmail.com', 'P.O. Box KN 1381, Kaneshie — Accra', 'Mangoes & Coconut', 10),
('corporate', 'farm-360-limited', 'Farm 360 Limited', 'Mr. Kenneth Abudulai Nelson', ARRAY['Orange Sweet Potato','Purple Sweet Potato','White Flesh Sweet Potato'], '+233 (0) 241 572 361', 'ken@farm360global.com', 'GD-0101-2697, House No. EA 2/16, Adentan East — Adenta, Accra', 'Sweet Potatoes', 20),
('corporate', 'iribov-west-africa', 'Iribov West Africa', NULL, ARRAY['Plant Propagation via Tissue Culture'], '+233 (0) 549 165 808', 'Veldhuijzen@iribov.com', 'P.O. Box 61, Sogakope (adjacent Comboni Hospital)', 'Plant Propagation', 30),
('corporate', 'kaleawo-limited', 'Kaleawo Limited', 'Mr. Seidu Mohammed Laberan', ARRAY['Pineapples'], '+233 (0) 542 494 404', 'seidu@kaleawo.com', '2nd Floor, World Trade Center, Independence Avenue — Ghana', 'Pineapples', 40),
('corporate', 'touch-skies-ghana', 'Touch Skies Ghana Limited', 'Alex Debrah', ARRAY['Fresh Yams','Fruit & Vegetables','Processed Foods'], '+233 (0) 244 926 341 / +233 553 778 905', 'alexandra@touchskies.com', 'BN 1050 Chocolate St, Shangai Rd, Kpone Katamanso. GK-0012-0826', 'Yams & Vegetables', 50),
('corporate', 'green-earth-farms', 'Green Earth Farms', 'Ms. Amina Rawlings', ARRAY['Coconuts'], '+233 (0) 248 888 813', 'amina@greenearthfarmsltd.com', NULL, 'Coconut', 60),
('corporate', 'panaasa-company-ltd', 'Panaasa Company LTD', NULL, ARRAY['Assorted Agricultural Products'], NULL, 'panaasa37@gmail.com', 'Donkorkrom-Goaso. P.O. Box CO 3995 Tema', 'Agricultural Products', 70),
('corporate', 'rosswood-company-ltd', 'Rosswood Company LTD', 'Mrs. Priscilla Asante', ARRAY['Raw & Processed Cashews','Cashew Spread','Yoghurt'], '+233 (0) 546 044 523', 'rosswoodghana@gmail.com', 'Tantra Hills 22, Emmaland Avenue', 'Cashew', 80),
('corporate', 'yeboah-kwesi-farms', 'Yeboah Kwesi Farms', 'Mr. Daniel Yeboah', ARRAY['Vegetables','Mangoes'], '+1 951 897 2517', 'danielyeboah@gmail.com', 'Afram Plains, Kwahu South District', 'Vegetables & Mangoes', 90),
('corporate', 'sk-essel-farms', 'S.K. Essel Farms', 'Mr. Samuel Essel', ARRAY['Home Choice Fufu','Home Choice Hausa Koko','Home Choice Kokonte','Gari','Home Choice Banku Mix','Plantain','Yams'], '+233 (0) 244 570 594', 'samuelkesselp@gmail.com', 'Amasaman Ayikia Doblo. P.O. Box KN 3568', 'Processed Foods', 100),
('corporate', 'de-vault-farms', 'De-Vault Farms Ltd', 'Mr. Nana Kweku Ampofo Twumasi', ARRAY['Cashew Nut','Coconut'], '+233 (0) 246 353 226', 'devault1910@gmail.com', 'Asante Mampong. P.O. Box CS 9010 Tema', 'Cashew & Coconut', 110),
('corporate', 'conyx-merchantile', 'Conyx Merchantile Ltd', 'Nana Kwaku Dua II', ARRAY['Agricultural Exports'], NULL, NULL, NULL, 'Agricultural Exports', 120),
('corporate', 'vivifos-farms', 'Vivifos Farms Ltd', 'Vivian Fosua', ARRAY['Mango','Coconuts','Roots & Tubers','Vegetables'], '+233 (0) 558 838 483', 'newvivifos@gmail.com', 'P.O. Box 32, Somanya — Eastern Region', 'Mixed Crops', 130),
('corporate', 'martinkings-import-export', 'Martinkings Import and Export', 'Martin Emmanuel Oppong', ARRAY['Yams','Cocoyam','Kokonte flour','Banku Mix flour','Hausa Koko flour','Gari','Aidan Fruit (Prekese)'], '+233 (0) 552 715 643', 'martinkingsexprot@gmail.com', 'P.O. Box 24, Olebu-Ablekum', 'Processed Foods', 140),
('corporate', 'shrigan-farms', 'Shrigan Farms', 'Pon G. Satheesan', ARRAY['Fresh Vegetables','Fruits','Coconuts','Yams'], '+233 (0) 246 881 154', 'ponsatheesh@hotmail.com', 'P.O. Box Aji-117, Adoayiri, Nsawam, Ghana', 'Mixed Crops', 150),
('corporate', 'rbd-organic-agro', 'RBD Organic Agro', 'Mr. Bright Emmanuel Adu Gyamfi', ARRAY['Mango','Maize','Yam','Fertilizer'], '+233 (0) 242 788 704', 'bright85@gmail.com', 'P.O. Box CO 3617, Tema Comm1', 'Mixed Crops', 160),
('corporate', 'yea-ecstasy-limited', 'Yea Ecstasy Limited', 'Mr. Emmanuel Asante Yeboah', ARRAY['Assorted Food Products'], '+233 (0) 551 546 185 / +233 (0) 596 048 009', 'yeaholdingsofficial@gmail.com', 'GE-296-3003, House No. 18, Haatso Westlands', 'Processed Foods', 170),
('corporate', 'hja-africa', 'HJA Africa', 'Mr. Henry Abraham', ARRAY['Organic liquid fertilizers','Pest repellants','Fungicides'], '+233 (0) 555 592 707', 'info@hjaafrica.com', 'Inside CSIR-IIR Compound, East Legon Boundary Road. P.O. Box LG 576, Accra', 'Organic Inputs', 180),
('corporate', 'adinkrah-heritage-farms', 'Adinkrah-Heritage Farms', 'Mr. Yaw Pare', ARRAY['Piggery','Goats','High Demand Crops'], '+233 (0) 543 289 231 / +233 (0) 505 577 771', 'ahfltd2023@gmail.com', NULL, 'Livestock & Crops', 190),
('corporate', 'shapes-pro-ltd', 'Shapes PRO Ltd', 'Vivienne Nayni', ARRAY['Agricultural Products'], NULL, NULL, NULL, 'Agricultural Products', 200),
('corporate', 'yedent-ghana', 'Yedent Ghana', NULL, ARRAY['Agro Processing'], '+233 (0) 208 166 021', 'info@yedentghana.com', 'Plot 27, Abesim Kyidom Industrial Area, Sunyani', 'Agro Processing', 210),
('corporate', 'veroni-ventures', 'Veroni Ventures', 'Veronica A.S. Frimpong', ARRAY['Mango','Vegetables','Yam','Cashew'], '+233 (0) 544 310 873', 'veroni.ventures@gmail.com', 'P.O. Box Oh 66, Odupong Kpehe', 'Mixed Crops', 220),
('corporate', 'gyarko-farms', 'Gyarko Farms Limited', NULL, ARRAY['Plantain','Cashew','Cocoyam','Peanut','Ginger'], '+233 (0) 556 586 007', 'ecosupremegh@gmail.com', '60 Mantse-Boi St, Kaneshie Cocoa Clinic Rd. P.O. Box CP 1796, Accra', 'Mixed Crops', 230),
('corporate', 'mitish-farms', 'Mitish Farms Limited', 'Mr. Alvin Ocloo', ARRAY['Fresh Mango','Coconut','Cashew','Vegetables'], '+233 (0) 506 691 605', 'Aocloo469@gmail.com', 'House No. ST1 Joggy''s Lane Adringanor, Accra', 'Mixed Crops', 240),
('corporate', 'eco-supreme-gh', 'Eco Supreme Gh Limited', 'Mrs. Nana Yaa Donkoh', ARRAY['Cashew Nut','Shea Butter','Agric Machinery'], '+233 (0) 556 586 007', 'ecosupremegh@gmail.com', '60 Mantse-Boi St, Kaneshie Cocoa Clinic Rd. P.O. Box CP 1796, Accra', 'Cashew & Shea', 250),
('corporate', 'tiwaa-farms', 'Tiwaa Farms', 'Clarence Sarkodie-Addo', ARRAY['Coconut','Grapes','Passion Fruits','Cassava','Livestock'], '+233 (0) 551 501 156', 'Accracsadoo@gmail.com', 'GA-585-3574, House No. 35, Otojor Abelekuma Market, Armah Street', 'Mixed Crops', 260),
('corporate', 'plantation-hub-africa', 'Plantation Hub Africa', 'Mr. G.O. Bekoe', ARRAY['Fruit of Tetrapleura Tetraptera (Prekese)'], '+233 (0) 208 817 098', 'planthub@gmail.com', NULL, 'Specialty Crops', 270),
('corporate', 'gaps-consults', 'GAPS Consults', 'Mr. Victor Avah', ARRAY['Consultancy'], '+233 (0) 244 507 530 / +233 (0) 208 110 559', 'victoravah@yahoo.co.uk', 'F8 Church Ridge, Community 11, Akosombo. P.O. Box AB69', 'Consultancy', 280),
('corporate', 'aseda-foods-agro', 'Aseda Foods and Agro Business', 'Mr. Philip Morrison', ARRAY['Ginger','Cayenne Pepper'], '+233 (0) 557 751 220 / +233 (0) 202 104 138', 'asedafoodandagrobusienss@gmail.com', 'GE-3269-896, P.O. Box 633, Ofankor, Accra', 'Spices', 290);
