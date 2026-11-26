// What each recorded clip does. Every action here is a read, a scroll, or (on the demo fork only) a free local write.
const VAULT = "0xcc8cb1Ae278dbc5077A8c0aB7517F1278C84Be3B";
const FIRST_PACT_TX = "0x57cc01a92e4234db6fca5bc0c0eb6d7998fa3593e5a35616161592cb3e7117ff";

export function register({ clip, MAINNET, DEMO, MAYA, FIND }) {
  const byId = (id) => `document.getElementById(${JSON.stringify(id)})`;

  // The landing page on QIE Mainnet: hero, totals read from the chain, the four clauses, the QIE section.
  clip("home", {
    source: "mainnet",
    url: `${MAINNET}/`,
    async run(p, t) {
      t.mark("hero");
      await t.sleep(2600);
      await t.rect("hero", `document.querySelector("main")`);
      await t.scrollToEl(`document.querySelector("main section")`, 40, 1600);
      t.mark("stats");
      await t.sleep(1800);
      await t.scrollToEl(byId("terms"), 100, 1600);
      t.mark("terms");
      await t.rect("terms", byId("terms"));
      await t.sleep(3200);
      await t.scrollToEl(byId("qie"), 100, 1600);
      t.mark("qie");
      await t.rect("qie", byId("qie"));
      await t.sleep(3600);
    },
  });

  // Signing a pact on the demo fork: the habit, the term, the stake, the signature, then the wallet progress window.
  clip("create", {
    source: "demo",
    url: `${DEMO}/app`,
    wallet: MAYA,
    skew: true,
    async run(p, t) {
      const dlg = (sel) => `document.querySelector("[role=dialog] ${sel}")`;
      await t.sleep(1500);
      t.mark("open");
      await t.tapText("Draft a new pact");
      await t.sleep(900);
      t.mark("form");
      await t.type(dlg("input[type=text]"), "Read twenty pages every day", 60);
      await t.sleep(400);
      await t.tapText("Learning", "[role=dialog] button");
      await t.sleep(500);
      await t.tapText("7 days", "[role=dialog] button");
      await t.sleep(500);
      t.mark("stake");
      await t.tapText("In QIE", "[role=dialog] button");
      await t.tap(`([...document.querySelectorAll("[role=dialog] button")].find(e => e.innerText.trim() === "1"))`, { pause: 300 });
      await t.sleep(700);
      const sig = `([...document.querySelectorAll("[role=dialog] div")].filter(e => /Your signature/.test(e.innerText) && /checked against/.test(e.innerText)).pop())`;
      await t.reveal(sig, "end");
      t.mark("sig");
      await t.rect("signature", sig);
      await t.sleep(2200);
      await t.reveal(FIND("Sign & lock", "[role=dialog] button"));
      t.mark("sign");
      await t.tapText("Sign & lock", "[role=dialog] button");
      await t.sleep(900);
      t.mark("tracker");
      await t.waitFor(FIND("Done", "button"), 25000);
      await t.sleep(1800);
      t.mark("signed");
      await t.tapText("Done", "button");
      await t.sleep(1600);
    },
  });


  // A stand-in "photo" for the demo fork's verifier: a desk, an open book and a sticky note with today's code.
  const makePhoto = (code) => `(async () => {
    const c = document.createElement("canvas"); c.width = 1280; c.height = 960; const g = c.getContext("2d");
    const wood = g.createLinearGradient(0, 0, 1280, 960); wood.addColorStop(0, "#7a5638"); wood.addColorStop(1, "#4e3523"); g.fillStyle = wood; g.fillRect(0, 0, 1280, 960);
    for (let i = 0; i < 120; i++) { g.strokeStyle = "rgba(30,18,8," + (0.05 + Math.random() * 0.08) + ")"; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); const y = Math.random() * 960; g.moveTo(0, y); g.bezierCurveTo(400, y + 12, 800, y - 12, 1280, y + 6); g.stroke(); }
    g.save(); g.translate(560, 500); g.rotate(-0.07); g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = 40; g.shadowOffsetY = 24;
    g.fillStyle = "#efe6d2"; g.fillRect(-380, -270, 380, 540); g.fillStyle = "#e6dcc6"; g.fillRect(0, -270, 380, 540); g.shadowColor = "transparent";
    g.strokeStyle = "rgba(60,45,30,.35)"; g.lineWidth = 2; for (let i = 0; i < 17; i++) { const y = -220 + i * 28; g.beginPath(); g.moveTo(-340, y); g.lineTo(-40, y); g.moveTo(40, y); g.lineTo(340, y); g.stroke(); }
    g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(-4, -270, 8, 540); g.restore();
    g.save(); g.translate(900, 330); g.rotate(0.1); g.shadowColor = "rgba(0,0,0,.4)"; g.shadowBlur = 24; g.shadowOffsetY = 14; g.fillStyle = "#f3d65a"; g.fillRect(-170, -150, 340, 300); g.shadowColor = "transparent";
    g.fillStyle = "#1d1a14"; g.font = "700 150px 'Bradley Hand', 'Segoe Print', 'Comic Sans MS', cursive"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(${JSON.stringify(code)}, 0, 8); g.restore();
    g.fillStyle = "rgba(240,240,240,.9)"; g.beginPath(); g.arc(1020, 760, 90, 0, 7); g.fill(); g.fillStyle = "#3a2417"; g.beginPath(); g.arc(1020, 760, 66, 0, 7); g.fill();
    const v = g.createRadialGradient(640, 480, 300, 640, 480, 820); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.45)"); g.fillStyle = v; g.fillRect(0, 0, 1280, 960);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.9));
    const input = document.querySelector("[role=dialog] input[type=file]"); const dt = new DataTransfer(); dt.items.add(new File([blob], "proof.jpg", { type: "image/jpeg" }));
    input.files = dt.files; input.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`;

  // Connect through the wallet picker, as a first-time visitor would.
  const connect = async (t) => {
    await t.tapText("Connect", "button");
    await t.sleep(700);
    await t.tapText("QIE Wallet", "button");
    await t.sleep(2600);
  };

  // A daily check-in on the demo fork: today's code, a photo, the verdict, then the signed attestation going on-chain.
  clip("checkin", {
    source: "demo",
    url: `${DEMO}/app`,
    wallet: MAYA,
    skew: true,
    async run(p, t) {
      await t.sleep(1200);
      await connect(t);
      t.mark("pacts");
      await t.waitFor(FIND("Present proof for day 1", "button"), 15000);
      await t.sleep(1200);
      await t.tapText("Present proof for day 1", "button");
      await t.sleep(1400);
      t.mark("modal");
      await t.rect("code", `document.querySelector("[role=dialog] .num, [role=dialog] [class*=tracking]")?.closest("div")`);
      const code = await p.js(`([...document.querySelectorAll("[role=dialog]")].pop().innerText.match(/TODAY'S CODE\\s*([0-9]{4})/i) || [])[1]`);
      console.log("  code", code);
      await t.sleep(2600);
      await t.tap(`document.querySelector("[role=dialog] label")`, { pause: 200 });
      await p.js(makePhoto(code));
      await t.sleep(1800);
      t.mark("photo");
      console.log("  dialog:", (await p.js(`[...document.querySelectorAll("[role=dialog]")].pop().innerText`)).replace(/\n+/g, " | ").slice(0, 300));
      await t.tapText("Ask the AI witness", "[role=dialog] button");
      t.mark("asked");
      await t.sleep(3500);
      console.log("  dialog:", (await p.js(`[...document.querySelectorAll("[role=dialog]")].pop().innerText`)).replace(/\n+/g, " | ").slice(0, 500));
      t.mark("verdict");
      await t.rect("report", `([...document.querySelectorAll("[role=dialog] *")].find(e => e.children.length > 2 && /witness report/i.test(e.innerText) && e.innerText.length < 400))`);
      await t.sleep(3200);
      await t.reveal(FIND("Stamp day 1", "[role=dialog] button"));
      await t.tapText("Stamp day 1", "[role=dialog] button");
      t.mark("stamp");
      await t.waitFor(`/on the record/i.test([...document.querySelectorAll("[role=dialog]")].pop().innerText)`, 30000);
      t.mark("stamped");
      await t.sleep(4200);
      await t.tap(`document.querySelector("[role=dialog] button[aria-label=Close]")`);
      await t.sleep(1000);
      t.mark("card");
      await t.sleep(2800);
    },
  });

  // The public explorer: the vault contract, then the very first pact signed on mainnet.
  clip("explorer", {
    source: "explorer",
    url: `https://mainnet.qie.digital/address/${VAULT}`,
    settle: 6500,
    async run(p, t) {
      t.mark("vault");
      await t.sleep(2800);
      await t.scrollTo(520, 1500);
      await t.sleep(2200);
      await p.goto(`https://mainnet.qie.digital/tx/${FIRST_PACT_TX}`, 6500);
      t.mark("tx");
      await t.sleep(3200);
    },
  });
}
