/**
 * The fake world the mock starts with (and goes back to on "Reset data").
 * Every person here is made up. Ids are stable across resets, and timestamps
 * are relative to the moment of seeding, so "today" filters have data.
 */
import { DAY, HOUR, avatar, iso, newId, rng, sid } from "./core.js";
import {
  notifyCampusProviders,
  notifyCurators,
  notifyProvider,
} from "./events.js";
import {
  INSTRUMENTS,
  answerRun,
  createRun,
  randomAccessCode,
  submitRun,
} from "./nsmq-engine.js";

export const PASSWORD = "Password1";

export function seed() {
  const now = Date.now();
  const R = rng(20261028);
  const pickOne = (list) => list[Math.floor(R() * list.length)];
  const ago = (ms) => iso(now - ms);

  const db = {
    accounts: [],
    providers: [],
    campusTypes: [
      {
        code: "JHS",
        label: "Junior High School",
        card: "HIGH_SCHOOL",
        quickScreenMinAge: 11,
        quickScreenMaxAge: 18,
        quickScreenYears: ["JHS 1", "JHS 2", "JHS 3"],
      },
      {
        code: "SHS",
        label: "Senior High School",
        card: "HIGH_SCHOOL",
        quickScreenMinAge: 14,
        quickScreenMaxAge: 21,
        quickScreenYears: ["Form 1", "Form 2", "Form 3"],
      },
      {
        code: "NMTC",
        label: "Nursing and Midwifery Training College",
        card: "COLLEGE",
        quickScreenMinAge: 16,
        quickScreenMaxAge: 30,
        quickScreenYears: ["Level 100", "Level 200", "Level 300", "Level 400"],
      },
      {
        code: "COLLEGE",
        label: "College",
        card: "COLLEGE",
        quickScreenMinAge: 16,
        quickScreenMaxAge: 30,
        quickScreenYears: ["Level 100", "Level 200", "Level 300", "Level 400"],
      },
      {
        code: "UNIVERSITY",
        label: "University",
        card: "COLLEGE",
        quickScreenMinAge: 16,
        quickScreenMaxAge: 30,
        quickScreenYears: ["Level 100", "Level 200", "Level 300", "Level 400"],
      },
    ],
    locations: [],
    campuses: [],
    programmes: [],
    tags: [],
    offerings: [],
    roleCategories: [],
    roles: [],
    campusProviders: [],
    joinRequests: [],
    results: [],
    notifications: [],
    versions: [],
    teams: [],
    codes: [],
    fixtures: [],
    enrollments: [],
    runs: [],
    careCases: [],
    treatments: [],
    careOutcomes: [],
    venues: [],
    circles: [],
    hosts: [],
    campusHosts: [],
    covers: [],
    icons: [],
    teamEntries: [],
    reachBaselines: { global: 1200 },
    audit: [],
    pendingSignUps: {},
    grants: {},
    logins: [],
    dueMode: "D1",
  };

  // ---------- Locations and campuses ----------
  const loc = {};
  for (const name of ["Accra", "Kumasi", "Cape Coast", "Tamale", "Ho"]) {
    loc[name] = { id: sid(`location:${name}`), name };
    db.locations.push(loc[name]);
  }

  const campus = {};
  const campusRows = [
    [
      "presec",
      "Presbyterian Boys' Senior High School",
      ["PRESEC", "Presec Legon"],
      "In Lumine Tuo Videbimus Lumen",
      "SHS",
      "Accra",
    ],
    [
      "achimota",
      "Achimota School",
      ["Motown", "Achimota"],
      "Ut Omnes Unum Sint",
      "SHS",
      "Accra",
    ],
    [
      "wesley",
      "Wesley Girls' High School",
      ["Wey Gey Hey"],
      "Live Pure, Speak True, Right Wrong, Follow the King",
      "SHS",
      "Cape Coast",
    ],
    [
      "prempeh",
      "Prempeh College",
      ["Amanfoo", "Prempeh"],
      "Suban Pa Ne Nimdee",
      "SHS",
      "Kumasi",
    ],
    [
      "mfantsipim",
      "Mfantsipim School",
      ["Kwabotwe", "Mfantsipim"],
      "Dwen Hwe Kan",
      "SHS",
      "Cape Coast",
    ],
    ["opoku", "Opoku Ware School", ["OWASS"], null, "SHS", "Kumasi"],
    ["tamale", "Tamale Senior High School", ["TAMASCO"], null, "SHS", "Tamale"],
    ["mawuli", "Mawuli School", ["Mawuli"], null, "SHS", "Ho"],
    ["ridge", "Ridge Church School", ["Ridge"], null, "JHS", "Accra"],
    [
      "ug",
      "University of Ghana",
      ["UG", "Legon"],
      "Integri Procedamus",
      "UNIVERSITY",
      "Accra",
    ],
    [
      "knust",
      "Kwame Nkrumah University of Science and Technology",
      ["KNUST", "Tech"],
      "Nyansapo Wosane No Badwemma",
      "UNIVERSITY",
      "Kumasi",
    ],
    [
      "korlebu",
      "Korle Bu Nursing and Midwifery Training College",
      ["KBNMTC"],
      null,
      "NMTC",
      "Accra",
    ],
  ];
  for (const [key, fullName, nicknames, motto, type, city] of campusRows) {
    campus[key] = {
      id: sid(`campus:${key}`),
      fullName,
      nicknames,
      motto,
      type,
      locationId: loc[city].id,
      logo: avatar(
        nicknames[0]
          .replace(/[^A-Za-z]/g, "")
          .slice(0, 3)
          .toUpperCase(),
        key,
      ),
      banner: null,
      defaultGraduationMonth: type === "SHS" ? 7 : 6,
      sites: [{ id: sid(`site:${key}:main`), name: "Main campus" }],
      archived: false,
      version: 1,
    };
    db.campuses.push(campus[key]);
  }

  // ---------- Programmes, tags and what each campus offers ----------
  const programme = {};
  for (const [key, fullName, nicknames, years] of [
    ["sci", "General Science", ["Science", "Sci"], 3],
    ["arts", "General Arts", ["Arts"], 3],
    ["biz", "Business", ["Biz"], 3],
    ["va", "Visual Arts", ["VA"], 3],
    ["he", "Home Economics", ["HE"], 3],
    ["cs", "BSc Computer Science", ["CS", "Comp Sci"], 4],
    ["nursing", "BSc Nursing", ["Nursing"], 4],
    ["psych", "BA Psychology", ["Psych"], 4],
    ["midwifery", "Diploma in Midwifery", ["Midwifery"], 3],
  ]) {
    programme[key] = {
      id: sid(`programme:${key}`),
      fullName,
      nicknames: nicknames.map((name) => ({
        id: sid(`programme:${key}:nick:${name}`),
        name,
      })),
      bio: `${fullName} at JustGo partner campuses.`,
      cover: null,
      defaultYears: years,
      version: 1,
    };
    db.programmes.push(programme[key]);
  }

  const residence = {
    id: sid("tag:residence"),
    title: "Residence",
    options: ["Boarding", "Day"].map((label) => ({
      id: sid(`tag:residence:${label}`),
      label,
    })),
    version: 1,
  };
  const house = {
    id: sid("tag:house"),
    title: "House",
    options: ["Aggrey", "Guggisberg", "Livingstone", "Lugard"].map((label) => ({
      id: sid(`tag:house:${label}`),
      label,
    })),
    version: 1,
  };
  db.tags.push(residence, house);

  const offer = (campusKey, programmeKeys) => {
    for (const key of programmeKeys) {
      const p = programme[key];
      db.offerings.push({
        campusId: campus[campusKey].id,
        programmeId: p.id,
        yearsFrom: 1,
        yearsTo: p.defaultYears,
        graduationMonth: null,
        nicknameIds: [p.nicknames[0].id],
        tagOptions: { [residence.id]: residence.options.map((o) => o.id) },
      });
    }
  };
  for (const key of ["presec", "achimota", "prempeh", "mfantsipim", "opoku"])
    offer(key, ["sci", "arts", "biz", "va"]);
  offer("wesley", ["sci", "arts", "biz", "va", "he"]);
  offer("ug", ["cs", "nursing", "psych"]);
  offer("korlebu", ["nursing", "midwifery"]);
  // tamale, mawuli, ridge and knust offer nothing yet: the patient sees the whole catalogue.

  // ---------- Roles and role groups ----------
  const role = {};
  for (const [key, name, emoji] of [
    ["counsellor", "School Counsellor", "🧠"],
    ["psychologist", "Clinical Psychologist", "🧑‍⚕️"],
    ["psychiatrist", "Psychiatrist", "💊"],
    ["nurse", "Nurse", "🩺"],
    ["gp", "General Practitioner", "👩‍⚕️"],
    ["coach", "Wellbeing Coach", "🌱"],
    ["chaplain", "Chaplain", "🙏"],
    ["peer", "Peer Mentor", "🤝"],
  ]) {
    role[key] = { id: sid(`role:${key}`), name, emoji };
    db.roles.push(role[key]);
  }
  const category = {};
  for (const [key, name, dormant, roleKeys, offKeys = []] of [
    ["counselling", "Counselling", false, ["counsellor", "psychologist"]],
    ["medical", "Medical", false, ["psychiatrist", "nurse", "gp"]],
    ["wellbeing", "Wellbeing", false, ["coach", "chaplain", "peer"], ["peer"]],
    ["nutrition", "Nutrition", true, []],
  ]) {
    category[key] = {
      id: sid(`category:${key}`),
      name,
      dormant,
      roles: roleKeys.map((r) => ({
        roleId: role[r].id,
        active: !offKeys.includes(r),
      })),
      version: 1,
    };
    db.roleCategories.push(category[key]);
  }

  // ---------- Curators ----------
  const login = (role, contact, note) =>
    db.logins.push({ role, contact, note });
  const curator = {
    id: sid("account:curator"),
    role: "CURATOR",
    contact: "curator@justgo.test",
    password: PASSWORD,
    claimed: true,
    curator: { fullName: "Akosua Boateng" },
  };
  db.accounts.push(curator, {
    id: sid("account:newcurator"),
    role: "CURATOR",
    contact: "newcurator@justgo.test",
    password: null,
    claimed: false,
    curator: { fullName: "Kwesi Appiah" },
  });
  login("CURATOR", "curator@justgo.test", "Curator, full access");
  login(
    "CURATOR",
    "newcurator@justgo.test",
    "Not set up yet: claim it with code 123456",
  );

  // ---------- Providers ----------
  const provider = {};
  function addProvider(key, p, account) {
    provider[key] = {
      id: sid(`provider:${key}`),
      title: null,
      nicknames: [],
      email: null,
      phone: null,
      photo: null,
      slogan: null,
      clinicianNotes: null,
      bio: null,
      clinical: false,
      submittedAt: null,
      decidedAt: null,
      roleCategoryIds: [],
      studioCreated: false,
      version: 1,
      ...p,
    };
    db.providers.push(provider[key]);
    if (account) {
      db.accounts.push({
        id: sid(`account:provider:${key}`),
        role: "PROVIDER",
        contact: p.email,
        password: account.claimed ? PASSWORD : null,
        claimed: account.claimed,
        providerId: provider[key].id,
      });
    }
  }

  addProvider(
    "abena",
    {
      title: "Dr.",
      fullName: "Abena Mensah",
      nicknames: ["Dr. Abena"],
      email: "provider@justgo.test",
      phone: "+233241112233",
      photo: avatar("AM", "abena"),
      slogan: "Here to listen, here to help.",
      clinicianNotes: "Prefers to see students in the sick bay after classes.",
      bio: "School counsellor with ten years in Accra secondary schools.",
      clinical: true,
      status: "APPROVED",
      submittedAt: ago(32 * DAY),
      decidedAt: ago(30 * DAY),
      roleCategoryIds: [category.counselling.id, category.wellbeing.id],
    },
    { claimed: true },
  );
  login(
    "PROVIDER",
    "provider@justgo.test",
    "Approved; serves PRESEC (NSMQ counsellor), Achimota, Wesley Girls",
  );

  addProvider(
    "kwame",
    {
      title: "Mr.",
      fullName: "Kwame Owusu",
      email: "pending@justgo.test",
      phone: "+233205556677",
      photo: avatar("KO", "kwame"),
      status: "PENDING",
      submittedAt: ago(1 * DAY),
      roleCategoryIds: [category.counselling.id],
    },
    { claimed: true },
  );
  login(
    "PROVIDER",
    "pending@justgo.test",
    "Application waiting in the curator's Just In queue",
  );

  addProvider(
    "efua",
    {
      title: "Ms.",
      fullName: "Efua Asante",
      email: "rejected@justgo.test",
      phone: "+233277778899",
      photo: avatar("EA", "efua"),
      status: "REJECTED",
      submittedAt: ago(5 * DAY),
      decidedAt: ago(2 * DAY),
      roleCategoryIds: [category.wellbeing.id],
    },
    { claimed: true },
  );
  login("PROVIDER", "rejected@justgo.test", "Rejected; can edit and resubmit");

  addProvider(
    "yaw",
    {
      title: "Mr.",
      fullName: "Yaw Boateng",
      email: "draft@justgo.test",
      status: "DRAFT",
    },
    { claimed: true },
  );
  login(
    "PROVIDER",
    "draft@justgo.test",
    "Profile not finished (needs phone, specialties, photo)",
  );

  addProvider(
    "kojo",
    {
      title: "Dr.",
      fullName: "Kojo Antwi",
      email: "kojo@justgo.test",
      phone: "+233244445566",
      photo: avatar("KA", "kojo"),
      clinical: true,
      status: "APPROVED",
      submittedAt: ago(22 * DAY),
      decidedAt: ago(20 * DAY),
      roleCategoryIds: [category.medical.id],
    },
    { claimed: true },
  );
  login(
    "PROVIDER",
    "kojo@justgo.test",
    "Approved, no schools yet; asked to join Prempeh",
  );

  addProvider(
    "nana",
    {
      title: "Ms.",
      fullName: "Nana Adjei",
      nicknames: ["Auntie Nana"],
      email: "invite@justgo.test",
      phone: "+233209990011",
      status: "APPROVED",
      decidedAt: ago(10 * DAY),
      roleCategoryIds: [category.wellbeing.id],
      studioCreated: true,
    },
    { claimed: false },
  );
  login(
    "PROVIDER",
    "invite@justgo.test",
    "Created in Studios and invited: claim it with code 123456",
  );

  addProvider("asare", {
    title: "Dr.",
    fullName: "Kofi Asare",
    email: "kofi.asare@justgo.test",
    clinical: true,
    status: "APPROVED",
    decidedAt: ago(40 * DAY),
    roleCategoryIds: [category.medical.id],
    studioCreated: true,
    photo: avatar("KA", "asare"),
  });
  addProvider("akua", {
    title: "Mrs.",
    fullName: "Akua Frimpong",
    email: "akua.frimpong@justgo.test",
    status: "APPROVED",
    decidedAt: ago(35 * DAY),
    roleCategoryIds: [category.wellbeing.id],
    studioCreated: true,
    photo: avatar("AF", "akua"),
  });
  addProvider("selorm", {
    title: "Mr.",
    fullName: "Selorm Agbeko",
    email: "selorm@justgo.test",
    status: "APPROVED",
    decidedAt: ago(28 * DAY),
    roleCategoryIds: [category.counselling.id],
    studioCreated: true,
  });
  addProvider("amaN", {
    title: "Dr.",
    fullName: "Ama Nkrumah",
    clinical: true,
    status: "APPROVED",
    decidedAt: ago(12 * DAY),
    roleCategoryIds: [category.medical.id],
    studioCreated: true,
  });

  // Application history (a provider's own PROVIDER_APPLICATION rows show in their list).
  const request = (
    key,
    kind,
    status,
    createdAt,
    decidedAt,
    targetType = null,
    targetId = null,
  ) =>
    db.joinRequests.push({
      id: sid(`request:${key}`),
      kind,
      status,
      createdAt,
      decidedAt,
      providerId: provider[key.split(":")[0]].id,
      targetType,
      targetId,
    });
  request(
    "abena:app",
    "PROVIDER_APPLICATION",
    "APPROVED",
    ago(32 * DAY),
    ago(30 * DAY),
  );
  request("kwame:app", "PROVIDER_APPLICATION", "PENDING", ago(1 * DAY), null);
  request(
    "efua:app",
    "PROVIDER_APPLICATION",
    "DECLINED",
    ago(5 * DAY),
    ago(2 * DAY),
  );
  request(
    "kojo:app",
    "PROVIDER_APPLICATION",
    "APPROVED",
    ago(22 * DAY),
    ago(20 * DAY),
  );

  // ---------- Who serves which campus ----------
  const attach = (campusKey, providerKey, opts = {}) =>
    db.campusProviders.push({
      campusId: campus[campusKey].id,
      providerId: provider[providerKey].id,
      roleCategoryId: provider[providerKey].roleCategoryIds[0] ?? null,
      nsmqCounsellor: !!opts.counsellor,
      mainHost: !!opts.mainHost,
      broughtByCampusHostId: null,
      attachedAt: ago(14 * DAY),
    });

  for (const key of ["presec", "achimota", "wesley"]) {
    request(
      `abena:${key}`,
      "JOIN_CAMPUS",
      "APPROVED",
      ago(15 * DAY),
      ago(14 * DAY),
      "CAMPUS",
      campus[key].id,
    );
    attach(key, "abena", { counsellor: key === "presec" });
    notifyProvider(db, provider.abena.id, {
      type: "PROVIDER_ADDED",
      title: `You were added to ${campus[key].fullName}`,
      body: "You can now see this school's results.",
      data: { campusId: campus[key].id, providerId: provider.abena.id },
      at: ago(14 * DAY),
      read: true,
    });
  }
  notifyProvider(db, provider.abena.id, {
    type: "APPLICATION_ACCEPTED",
    title: "Your application was accepted",
    body: "Welcome to JustGo Health.",
    at: ago(30 * DAY),
    read: true,
  });
  attach("presec", "asare", { mainHost: true });
  attach("achimota", "akua");
  attach("wesley", "akua");
  attach("mawuli", "selorm", { counsellor: true });
  attach("prempeh", "asare");

  request(
    "kojo:prempeh",
    "JOIN_CAMPUS",
    "PENDING",
    ago(3 * HOUR),
    null,
    "CAMPUS",
    campus.prempeh.id,
  );

  // ---------- Hosts and venues ----------
  const venue = {};
  for (const [key, title, serviceTypes] of [
    ["accra", "JustGo Clinic, Accra", ["Counselling", "Medical"]],
    ["kumasi", "Kumasi Wellness Hub", ["Counselling", "Wellbeing"]],
    ["capecoast", "Cape Coast Teen Centre", ["Wellbeing"]],
  ]) {
    venue[key] = {
      id: sid(`venue:${key}`),
      title,
      bio: `${title}: walk-in support for students.`,
      serviceTypes,
      version: 1,
    };
    db.venues.push(venue[key]);
  }
  db.circles.push({
    venueId: venue.accra.id,
    connectedId: venue.kumasi.id,
    serviceTypes: ["Counselling"],
    addedAt: ago(20 * DAY),
  });

  const host = {};
  for (const [key, fullName, nicknames, type, city, venueKeys] of [
    ["jgh", "JustGo Health", ["JGH"], "CURATOR", "Accra", ["accra"]],
    [
      "kbth",
      "Korle Bu Teaching Hospital",
      ["KBTH"],
      "CLINICAL",
      "Accra",
      ["accra"],
    ],
    [
      "mmg",
      "Mind Matters Ghana",
      ["MMG"],
      "BRAND",
      "Kumasi",
      ["kumasi", "capecoast"],
    ],
  ]) {
    host[key] = {
      id: sid(`host:${key}`),
      fullName,
      nicknames,
      type,
      bio: `${fullName} partners with JustGo Health to support students.`,
      locationId: loc[city].id,
      photo: avatar(nicknames[0], key),
      version: 1,
      venueIds: venueKeys.map((v) => venue[v].id),
      network: [],
      partners: [],
      providers: [],
    };
    db.hosts.push(host[key]);
  }
  host.jgh.network = [host.kbth.id, host.mmg.id];
  host.jgh.partners = [
    { hostId: host.kbth.id, joinType: "CLINICAL", venueIds: [venue.accra.id] },
  ];
  host.jgh.providers = [
    {
      providerId: provider.abena.id,
      roleCategoryId: category.counselling.id,
      mainHost: true,
      viaHostIds: [],
      attachedAt: ago(25 * DAY),
    },
  ];
  host.kbth.providers = [
    {
      providerId: provider.asare.id,
      roleCategoryId: category.medical.id,
      mainHost: true,
      viaHostIds: [],
      attachedAt: ago(25 * DAY),
    },
  ];
  db.campusHosts.push(
    {
      campusId: campus.presec.id,
      hostId: host.jgh.id,
      joinType: "CURATOR",
      mainVenueId: venue.accra.id,
      venueIds: [venue.accra.id],
      broughtByHostId: null,
      addedAt: ago(18 * DAY),
    },
    {
      campusId: campus.achimota.id,
      hostId: host.jgh.id,
      joinType: "CURATOR",
      mainVenueId: venue.accra.id,
      venueIds: [venue.accra.id],
      broughtByHostId: null,
      addedAt: ago(18 * DAY),
    },
    {
      campusId: campus.achimota.id,
      hostId: host.kbth.id,
      joinType: "CLINICAL",
      mainVenueId: null,
      venueIds: [venue.accra.id],
      broughtByHostId: host.jgh.id,
      addedAt: ago(18 * DAY),
    },
  );
  request(
    "kojo:kbth",
    "JOIN_HOST",
    "PENDING",
    ago(2 * HOUR),
    null,
    "HOST",
    host.kbth.id,
  );

  // ---------- Care catalogue ----------
  const treatment = {};
  [
    ["counsellor", "Talk to your school counsellor"],
    ["breathing", "Box breathing (4-4-4-4)"],
    ["sleep", "Wind-down sleep routine"],
    ["pomodoro", "Pomodoro study breaks"],
    ["peers", "Peer support circle"],
    ["helpline", "Call a helpline"],
    ["journal", "Journal three good things"],
  ].forEach(([key, name], i) => {
    treatment[key] = {
      id: sid(`treatment:${key}`),
      name,
      defaultRank: i + 1,
      photo: avatar(name.slice(0, 2).toUpperCase(), key),
      version: 1,
    };
    db.treatments.push(treatment[key]);
  });
  const link = (keys) =>
    keys.map((k, i) => ({ treatmentId: treatment[k].id, rank: i + 1 }));
  const sectionTitle = {
    GMH: "General Mental Health",
    ENERGY: "Energy & Recovery",
    MINDSET: "Mindset & Pressure",
    BODY: "Body & Energy",
    RECOVERY: "After the Contest",
    EXAM_STRESS: "Exam Stress",
    SLEEP: "Sleep",
  };
  const accountLinks = {
    GMH: {
      Average: ["journal", "peers"],
      Poor: ["counsellor", "peers", "journal"],
      "Very Poor": ["counsellor", "helpline"],
    },
    ENERGY: {
      Average: ["pomodoro", "sleep"],
      Poor: ["sleep", "pomodoro", "counsellor"],
      "Very Poor": ["counsellor", "sleep"],
    },
    MINDSET: {
      Average: ["breathing"],
      Poor: ["breathing", "counsellor"],
      "Very Poor": ["counsellor", "breathing"],
    },
    BODY: {
      Average: ["breathing"],
      Poor: ["sleep", "breathing"],
      "Very Poor": [],
    }, // left unlinked on purpose
    RECOVERY: {
      Average: ["peers"],
      Poor: ["peers", "counsellor"],
      "Very Poor": ["counsellor", "helpline"],
    },
  };
  for (const [code, bands] of Object.entries(accountLinks)) {
    for (const [band, keys] of Object.entries(bands)) {
      db.careOutcomes.push({
        id: sid(`outcome:ACCOUNT:${code}:${band}`),
        app: "ACCOUNT",
        sectionCode: code,
        sectionTitle: sectionTitle[code],
        band,
        label: `${sectionTitle[code]}: ${band}`,
        treatments: link(keys),
      });
    }
  }
  for (const code of ["GMH", "EXAM_STRESS", "SLEEP"]) {
    for (const band of ["Average", "Poor", "Very Poor"]) {
      db.careOutcomes.push({
        id: sid(`outcome:QUICK_SCREEN:${code}:${band}`),
        app: "QUICK_SCREEN",
        sectionCode: code,
        sectionTitle: sectionTitle[code],
        band,
        label: `${sectionTitle[code]}: ${band}`,
        treatments:
          code === "SLEEP" && band === "Average"
            ? []
            : link(
                band === "Average" ? ["journal"] : ["counsellor", "breathing"],
              ),
      });
    }
  }

  // ---------- NSMQ versions, teams, fixtures and codes ----------
  db.versions.push(
    {
      code: "nsmq2026",
      label: "NSMQ 2026",
      description:
        "National Science & Maths Quiz 2026: LOCK IN wellbeing check-ins for contestants.",
      status: "LIVE",
      startsAt: ago(30 * DAY),
      endsAt: iso(now + 60 * DAY),
      d1Hours: 24,
      t3Hours: 3,
      assentText:
        "I agree to take short wellbeing check-ins before and after my contests. My answers are shared with my school's counsellor and the JustGo Health care team so they can support me.",
      assentVersion: 2,
      campusTypes: ["SHS"],
      version: 3,
    },
    {
      code: "nsmq2025",
      label: "NSMQ 2025",
      description: "Last year's contest.",
      status: "CLOSED",
      startsAt: ago(400 * DAY),
      endsAt: ago(300 * DAY),
      d1Hours: 24,
      t3Hours: 3,
      assentText: "I agree to take short wellbeing check-ins.",
      assentVersion: 1,
      campusTypes: ["SHS"],
      version: 1,
    },
    {
      code: "nsmq2027",
      label: "NSMQ 2027",
      description: "Next year's contest.",
      status: "OPENS_SOON",
      startsAt: iso(now + 300 * DAY),
      endsAt: iso(now + 400 * DAY),
      d1Hours: 24,
      t3Hours: 3,
      assentText: null,
      assentVersion: 0,
      campusTypes: ["SHS"],
      version: 1,
    },
  );

  const team = {};
  const coordinators = {
    presec: "Mr. Daniel Ofori",
    achimota: "Mrs. Grace Tetteh",
    wesley: "Ms. Adjoa Quaye",
    prempeh: "Mr. Isaac Boakye",
    mfantsipim: "Mr. Paul Arthur",
    opoku: "Mr. Samuel Owusu",
  };
  Object.keys(coordinators).forEach((key, i) => {
    const eliminated = key === "opoku";
    team[key] = {
      id: sid(`team:nsmq2026:${key}`),
      versionCode: "nsmq2026",
      campusId: campus[key].id,
      status: eliminated ? "ELIMINATED" : "REGISTERED",
      coordinatorName: coordinators[key],
      coordinatorContact: `+23324000${String(1000 + i)}`,
      seatCapacity: key === "achimota" ? 12 : 10,
    };
    db.teams.push(team[key]);
    db.fixtures.push({
      id: sid(`fixture:nsmq2026:${key}:1`),
      teamId: team[key].id,
      roundName: "One-eighth stage",
      kickoffAt: eliminated ? ago(10 * DAY) : iso(now + 20 * HOUR),
      timezone: "Africa/Accra",
      venue: "Accra International Conference Centre",
      position: 1,
      status: eliminated ? "COMPLETED" : "SCHEDULED",
      outcome: eliminated ? "ELIMINATED" : "PENDING",
      eliminatedAt: eliminated ? ago(10 * DAY) : null,
      version: 1,
    });
    for (let seat = 1; seat <= 4; seat++) {
      db.codes.push({
        id: sid(`code:${key}:${seat}`),
        teamId: team[key].id,
        code: randomAccessCode(R),
        seatLabel: `Seat ${seat}`,
        batchId: sid(`batch:${key}:1`),
        status: "ISSUED",
        expiresAt: iso(now + 60 * DAY),
        redeemedAt: null,
      });
    }
  });
  db.teams.push({
    id: sid("team:nsmq2025:presec"),
    versionCode: "nsmq2025",
    campusId: campus.presec.id,
    status: "CHAMPION",
    coordinatorName: "Mr. Daniel Ofori",
    coordinatorContact: null,
    seatCapacity: 10,
  });

  // ---------- Patients ----------
  function addPatient(key, contact, patient, note) {
    const acc = {
      id: sid(`account:patient:${key}`),
      role: "PATIENT",
      contact,
      password: PASSWORD,
      claimed: true,
      patient: {
        photo: null,
        photoSkipped: false,
        campusId: null,
        programmeId: null,
        grade: null,
        onboarded: false,
        ...patient,
      },
    };
    db.accounts.push(acc);
    if (note) login("PATIENT", contact, note);
    return acc;
  }
  const enrol = (acc, teamKey, assentVersion = 2) =>
    db.enrollments.push({
      accountId: acc.id,
      versionCode: "nsmq2026",
      status: "ACTIVE",
      selectedCampusId: campus[teamKey].id,
      teamId: team[teamKey].id,
      assentVersion,
    });

  const ama = addPatient(
    "ama",
    "ama@justgo.test",
    {
      fullName: "Ama Serwaa Owusu",
      nickname: "ama_lockin",
      gender: "FEMALE",
      dateOfBirth: "2009-03-14",
      photo: avatar("AS", "ama"),
      campusId: campus.achimota.id,
      programmeId: programme.sci.id,
      grade: "SHS_3",
      onboarded: true,
    },
    "Achimota NSMQ team; a D-1 check-in is due now",
  );
  enrol(ama, "achimota");
  const kofi = addPatient(
    "kofi",
    "+233241234567",
    {
      fullName: "Kofi Mensah",
      nickname: "kofi.m",
      gender: "MALE",
      dateOfBirth: "2008-07-02",
      photo: avatar("KM", "kofi"),
      campusId: campus.presec.id,
      programmeId: programme.sci.id,
      grade: "SHS_3",
      onboarded: true,
    },
    "Phone sign-in (type 0241234567). PRESEC team; D-1 done, can retake",
  );
  enrol(kofi, "presec");
  const akosua = addPatient(
    "akosua",
    "akosua@justgo.test",
    {
      fullName: "Akosua Addo",
      nickname: "akos",
      gender: "FEMALE",
      dateOfBirth: "2009-09-30",
      photoSkipped: true,
      campusId: campus.achimota.id,
      programmeId: programme.biz.id,
      grade: "SHS_2",
      onboarded: true,
    },
    "Achimota team; the agreement changed, so she must accept it again",
  );
  enrol(akosua, "achimota", 1);
  addPatient(
    "esi",
    "esi@justgo.test",
    {
      fullName: "Esi Appiah",
      nickname: "esi_a",
      gender: "FEMALE",
      dateOfBirth: "2010-01-20",
    },
    "Brand new: starts onboarding at the photo step",
  );
  addPatient(
    "yawd",
    "yaw.darko@justgo.test",
    {
      fullName: "Yaw Darko",
      nickname: "yawd",
      gender: "MALE",
      dateOfBirth: "2005-11-11",
      photo: avatar("YD", "yawd"),
      campusId: campus.ug.id,
      programmeId: programme.cs.id,
      grade: "YEAR_2",
      onboarded: true,
    },
    "University student, not in NSMQ",
  );

  // Generated students behind the provider and curator dashboards.
  const first = {
    MALE: [
      "Kwabena",
      "Kojo",
      "Kwaku",
      "Yaw",
      "Kofi",
      "Kwame",
      "Kwesi",
      "Fiifi",
      "Nii",
      "Selasi",
      "Elikem",
      "Ebo",
    ],
    FEMALE: [
      "Abena",
      "Akua",
      "Yaa",
      "Afua",
      "Ama",
      "Adjoa",
      "Efua",
      "Esi",
      "Naa",
      "Dzifa",
      "Akosua",
      "Maame",
    ],
  };
  const last = [
    "Mensah",
    "Asante",
    "Owusu",
    "Boateng",
    "Ofori",
    "Agyeman",
    "Tetteh",
    "Quaye",
    "Darko",
    "Amoah",
    "Ansah",
    "Frimpong",
    "Addo",
    "Sarpong",
    "Acheampong",
    "Kuffour",
  ];
  const gendersAt = {
    presec: ["MALE"],
    wesley: ["FEMALE"],
    prempeh: ["MALE"],
    achimota: ["MALE", "FEMALE"],
    ug: ["MALE", "FEMALE"],
  };
  const students = [];
  let n = 0;
  for (const [key, count] of [
    ["presec", 8],
    ["achimota", 8],
    ["wesley", 8],
    ["prempeh", 6],
    ["ug", 6],
  ]) {
    for (let i = 0; i < count; i++) {
      n += 1;
      const gender = pickOne(gendersAt[key]);
      const fullName = `${pickOne(first[gender])} ${pickOne(last)}`;
      const college = key === "ug";
      const year = college
        ? 2003 + Math.floor(R() * 4)
        : 2008 + Math.floor(R() * 2);
      const acc = addPatient(`student${n}`, `student${n}@justgo.test`, {
        fullName,
        nickname: `${fullName.split(" ")[0].toLowerCase()}${n}`,
        gender,
        dateOfBirth: `${year}-0${1 + Math.floor(R() * 9)}-1${Math.floor(R() * 9)}`,
        photoSkipped: true,
        campusId: campus[key].id,
        programmeId: college
          ? programme.cs.id
          : programme[pickOne(["sci", "arts", "biz"])].id,
        grade: college
          ? pickOne(["YEAR_1", "YEAR_2", "YEAR_3", "YEAR_4"])
          : pickOne(["SHS_2", "SHS_3"]),
        onboarded: true,
      });
      students.push({ acc, key, index: i });
    }
  }

  // ---------- Quick Screen results (older, for the dashboards and filters) ----------
  const LOCK = [
    [85, "PURPLE", "Perfect"],
    [65, "GREEN", "Good"],
    [45, "LIGHT_GREEN", "Average"],
    [25, "RED", "Poor"],
    [0, "BLACK", "Very Poor"],
  ];
  const band = (pct) => LOCK.find(([min]) => pct >= min);
  const outcome = (code, max, pct) => {
    const clamped = Math.max(0, Math.min(100, pct));
    const [, colour, label] = band(clamped);
    return {
      sectionCode: code,
      sectionTitle: sectionTitle[code],
      parentCode: null,
      score: Math.round(((100 - clamped) / 100) * max),
      maxScore: max,
      band: label,
      colour,
    };
  };
  function quickScreen(
    { acc, key },
    createdMs,
    { awaiting = false, forceScore } = {},
  ) {
    const p = acc.patient;
    const score = forceScore ?? Math.round(15 + R() * 85);
    const [, colour] = band(score);
    const urgent = colour === "BLACK";
    const attention = urgent || colour === "RED";
    const result = {
      id: newId(),
      source: "QUICK_SCREEN",
      sourceId: newId(),
      campusId: campus[key].id,
      patientAccountId: acc.id,
      displayName: p.fullName,
      age: new Date(now).getUTCFullYear() - Number(p.dateOfBirth.slice(0, 4)),
      gender: p.gender,
      yearLabel: p.grade.startsWith("SHS")
        ? `SHS ${p.grade.slice(4)}`
        : `Year ${p.grade.slice(5)}`,
      variant: R() < 0.5 ? "EXAM" : "LOSS",
      createdAt: iso(createdMs),
      urgent,
      urgentReason: urgent ? "Very Poor general mental health" : null,
      attention,
      acceptedAt: awaiting && !urgent ? null : iso(createdMs + 10 * 60_000),
      active: true,
      lockedIn: { score, colour },
      suicidality: urgent ? "Passive thoughts" : "None",
      lastProviderView: null,
      seen: R() < 0.5,
      treatingStartedAt: null,
      respondBy: urgent
        ? iso(createdMs + 24 * HOUR)
        : attention
          ? iso(createdMs + 72 * HOUR)
          : null,
      outcomes: [
        outcome("GMH", 27, score + Math.round(R() * 20 - 10)),
        outcome("EXAM_STRESS", 20, score + Math.round(R() * 30 - 15)),
        outcome("SLEEP", 12, score + Math.round(R() * 30 - 15)),
      ],
      care: [],
      comments: [],
    };
    db.results.push(result);
    return result;
  }

  const qs = students.map((s, i) =>
    quickScreen(
      s,
      now - (2 + ((i * 7) % 90)) * DAY - Math.floor(R() * 20) * HOUR,
    ),
  );
  // New ones at Achimota waiting for the curator to accept them.
  for (const s of students.filter((x) => x.key === "achimota").slice(0, 3)) {
    quickScreen(s, now - (5 + Math.floor(R() * 40)) * HOUR, {
      awaiting: true,
      forceScore: 50 + Math.floor(R() * 30),
    });
  }
  // An overdue Very Poor result at Wesley, and one Dr. Abena is already treating at PRESEC.
  quickScreen(
    students.find((s) => s.key === "wesley"),
    now - 2 * DAY,
    { forceScore: 12 },
  ).seen = false;
  const treating =
    qs.find((r) => r.campusId === campus.presec.id && r.attention) ??
    qs.find((r) => r.campusId === campus.presec.id);
  treating.treatingStartedAt = ago(1 * DAY);
  treating.care.push({
    providerId: provider.abena.id,
    name: "Dr. Abena Mensah",
    status: "TREATING",
    referredBy: null,
    at: ago(1 * DAY),
  });
  treating.lastProviderView = {
    providerId: provider.abena.id,
    name: "Dr. Abena Mensah",
    initials: "AM",
    at: ago(1 * DAY),
  };
  treating.seen = true;
  treating.comments.push({
    id: newId(),
    authorAccountId: sid("account:provider:abena"),
    body: "Spoke with the student after class. Following up on Friday.",
    at: ago(20 * HOUR),
  });

  for (const key of ["presec", "achimota", "wesley"]) {
    notifyCampusProviders(db, campus[key].id, {
      type: "NEW_RESULTS",
      title: `New results at ${campus[key].fullName}`,
      body: "New Quick Screen results are ready to view.",
      data: { campusId: campus[key].id, count: 3 },
      at: ago(2 * DAY),
      read: key !== "achimota",
    });
  }

  // ---------- NSMQ D-1 check-ins already taken today ----------
  const profiles = {
    calm: (it) => (it.cssrs ? 0 : Math.floor(R() * 2)),
    stressed: (it) =>
      it.cssrs ? 0 : it.sectionCode === "GMH" ? 1 : 2 + Math.floor(R() * 2),
    crisis: (it) => (it.cssrs ? 1 : 2 + Math.floor(R() * 2)),
  };
  const d1Run = (acc, teamKey, profile, minutesAgo) => {
    const at = now - minutesAgo * 60_000;
    const run = createRun(db, {
      accountId: acc.id,
      versionCode: "nsmq2026",
      kind: "D1",
      obligationKey: `D1:FIXTURE:${sid(`fixture:nsmq2026:${teamKey}:1`)}`,
      campusId: campus[teamKey].id,
      attempt: 1,
      closesAt: iso(now + 17 * HOUR),
      at: at - 6 * 60_000,
    });
    for (const it of INSTRUMENTS.D1.items) {
      answerRun(
        run,
        it.code,
        it.options[Math.min(it.options.length - 1, profiles[profile](it))].id,
      );
    }
    submitRun(db, run, at);
  };

  const teamStudents = students.filter((s) => team[s.key]);
  for (const s of teamStudents) enrol(s.acc, s.key);
  for (const s of teamStudents) {
    if (s.index >= 5) continue; // the rest haven't checked in yet
    const crisis =
      (s.key === "presec" && s.index === 0) ||
      (s.key === "wesley" && s.index === 1);
    const stressed = s.index === 2 || (s.key === "achimota" && s.index === 3);
    d1Run(
      s.acc,
      s.key,
      crisis ? "crisis" : stressed ? "stressed" : "calm",
      30 + Math.floor(R() * 200),
    );
  }
  d1Run(kofi, "presec", "calm", 95);
  for (const t of Object.values(team)) {
    if (
      t.status !== "ELIMINATED" &&
      db.enrollments.some((e) => e.teamId === t.id)
    )
      t.status = "ACTIVE";
  }

  // ---------- Curator inbox ----------
  notifyCurators(db, {
    type: "PROVIDER_APPLICATION",
    title: "New provider application",
    body: "Mr. Kwame Owusu applied to join JustGo Health.",
    data: { providerId: provider.kwame.id },
    at: ago(1 * DAY),
  });
  notifyCurators(db, {
    campusId: campus.prempeh.id,
    type: "JOIN_REQUEST",
    title: "Request to join Prempeh College",
    body: "Dr. Kojo Antwi asked to serve Prempeh College.",
    data: { providerId: provider.kojo.id, targetId: campus.prempeh.id },
    at: ago(3 * HOUR),
  });

  // ---------- Landing pages ----------
  db.covers.push(
    {
      id: sid("cover:global"),
      campusId: null,
      photo: avatar("JGH", "cover-global"),
      slogan: "Lock in your wellbeing",
      colour: "#0E7C66",
      position: 0,
      version: 1,
    },
    {
      id: sid("cover:presec"),
      campusId: campus.presec.id,
      photo: avatar("PRE", "cover-presec"),
      slogan: "PRESEC locks in",
      colour: "#1D4ED8",
      position: 0,
      version: 1,
    },
  );
  db.icons.push(
    {
      id: sid("icon:1"),
      nickname: "KB",
      name: "Kwabena Asante",
      slogan: "Rest is part of the plan.",
      campusId: campus.presec.id,
      year: 2024,
      photo: avatar("KB", "icon1"),
      rank: 1,
      position: 0,
      achievements: ["NSMQ 2024 champion"],
      lockIns: ["NSMQ 2024"],
      phone: "+233200000001",
      version: 1,
    },
    {
      id: sid("icon:2"),
      nickname: "Yaa",
      name: "Yaa Agyeman",
      slogan: "Ask for help early.",
      campusId: campus.wesley.id,
      year: 2025,
      photo: avatar("YA", "icon2"),
      rank: 2,
      position: 1,
      achievements: ["NSMQ 2025 finalist"],
      lockIns: ["NSMQ 2025"],
      phone: null,
      version: 1,
    },
    {
      id: sid("icon:3"),
      nickname: null,
      name: "Elikem Tetteh",
      slogan: null,
      campusId: null,
      year: 2023,
      photo: null,
      rank: null,
      position: 2,
      achievements: [],
      lockIns: [],
      phone: null,
      version: 1,
    },
  );
  db.teamEntries.push(
    {
      id: sid("teamentry:1"),
      campusId: campus.presec.id,
      type: "COACH",
      fullName: "Mr. Daniel Ofori",
      rank: 1,
      version: 1,
    },
    {
      id: sid("teamentry:2"),
      campusId: null,
      type: "ADVISOR",
      fullName: "Prof. Efua Dartey",
      rank: 1,
      version: 1,
    },
    {
      id: sid("teamentry:3"),
      campusId: campus.achimota.id,
      type: "AMBASSADOR",
      fullName: "Abigail Tetteh",
      rank: 1,
      version: 1,
    },
  );
  db.reachBaselines[campus.presec.id] = 300;

  db.audit.push(
    {
      id: sid("audit:1"),
      occurredAt: ago(14 * DAY),
      actorAccountId: curator.id,
      action: "JOIN_REQUEST_APPROVED",
      entityType: "JOIN_REQUEST",
      entityId: sid("request:abena:presec"),
      campusId: campus.presec.id,
      summary: "Dr. Abena Mensah joined PRESEC",
      changes: null,
    },
    {
      id: sid("audit:2"),
      occurredAt: ago(2 * DAY),
      actorAccountId: curator.id,
      action: "JOIN_REQUEST_DECLINED",
      entityType: "PROVIDER",
      entityId: provider.efua.id,
      campusId: null,
      summary: "Ms. Efua Asante's application was declined",
      changes: null,
    },
  );

  return db;
}
