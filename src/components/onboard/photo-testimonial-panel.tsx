"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

// Real students, the thing each of them actually did, and the rating each
// left - ported from the legacy onboarding "receipts wall" cast list.
const CAST = [
  {
    name: "Setornam",
    quote: "@Setornam scored 1590 in the SAT",
    programme: "Bachelor's Degree",
    school: "Class of 2026, Academic City",
    rating: "5.0",
    img: "/images/testimonials/setornam.jpg",
    position: "center 22%",
  },
  {
    name: "Bonney",
    quote: "@Bonney got 9 Ones in the BECE 2022",
    programme: "MB ChB, Year 1",
    school: "Class of 2031, UG Medical School",
    rating: "4.9",
    img: "/images/testimonials/bonney.jpg",
    position: "center 24%",
  },
  {
    name: "Mandy",
    quote: "@Mandy walked out with 8 A's",
    programme: "Human Biology (Medicine)",
    school: "Class of 2029, KNUST",
    rating: "4.9",
    img: "/images/testimonials/ppMandy.jpg",
    position: "center 22%",
  },
  {
    name: "Kwame",
    quote: "@Kwame passed Part I first sitting",
    programme: "MB ChB, Year 4",
    school: "Class of 2028, KNUST",
    rating: "4.7",
    img: "/images/testimonials/ppKwame.jpg",
    position: "center 25%",
  },
  {
    name: "Maya",
    quote: "@Maya topped the Contracts curve",
    programme: "Juris Doctor, 1L",
    school: "Class of 2029, Harvard Law",
    rating: "4.8",
    img: "/images/testimonials/ppMaya.jpg",
    position: "center 20%",
  },
  {
    name: "Zara",
    quote: "@Zara sat every paper and passed clean",
    programme: "Nursing, GEPN",
    school: "Class of 2027, Yale Nursing",
    rating: "5.0",
    img: "/images/testimonials/ppZara.jpg",
    position: "center 28%",
  },
  {
    name: "Kwajo",
    quote: "@Kwajo shipped it before demo day",
    programme: "Mechanical Engineering",
    school: "Class of 2027, MIT",
    rating: "4.6",
    img: "/images/testimonials/ppKwajo.jpg",
    position: "center 30%",
  },
  {
    name: "Prince",
    quote: "@Prince took the SAT from 1240 to 1500",
    programme: "SAT & US Applications",
    school: "Class of 2027, Achimota",
    rating: "4.8",
    img: "/images/testimonials/ppPrince.jpg",
    position: "center 24%",
  },
  {
    name: "Christine",
    quote: "@Christine took her CWA to a first",
    programme: "Computer Science, Level 300",
    school: "Class of 2027, Legon",
    rating: "4.7",
    img: "/images/testimonials/ppChristine.jpg",
    position: "center 22%",
  },
  {
    name: "Jesse",
    quote: "@Jesse owned Data Structures",
    programme: "BSc Computer Science",
    school: "Class of 2028, Ashesi",
    rating: "4.5",
    img: "/images/testimonials/ppJesse.jpg",
    position: "center 26%",
  },
  {
    name: "Adwoa",
    quote: "@Adwoa cleared four papers and the fear",
    programme: "MB ChB, Year 2",
    school: "Class of 2030, UG Medical",
    rating: "4.9",
    img: "/images/testimonials/ppAdwoa.jpg",
    position: "center 20%",
  },
  {
    name: "Jonathan",
    quote: "@Jonathan landed the fintech offer",
    programme: "CS, Sophomore",
    school: "Class of 2029, Georgia Tech",
    rating: "4.6",
    img: "/images/testimonials/ppJonathan.jpg",
    position: "center 26%",
  },
  {
    name: "Nana Ama",
    quote: "@Nana Ama took ten Grade 1s in Mock 1",
    programme: "JHS 3, Final Year",
    school: "BECE April, The Light Academy",
    rating: "4.9",
    img: "/images/testimonials/ppNana.jpg",
    position: "center 25%",
  },
];

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      {direction === "left" ? (
        <path d="M15 5l-7 7 7 7" />
      ) : (
        <path d="M9 5l7 7-7 7" />
      )}
    </svg>
  );
}

export function PhotoTestimonialPanel({ className }: { className?: string }) {
  const [idx, setIdx] = useState(0);
  const [swapping, setSwapping] = useState(false);
  const held = useRef(false);
  const swappingRef = useRef(false);

  function go(step: number) {
    if (swappingRef.current) return;
    swappingRef.current = true;
    setSwapping(true);
    setTimeout(() => {
      setIdx((i) => (i + step + CAST.length) % CAST.length);
      setSwapping(false);
      swappingRef.current = false;
    }, 220);
  }

  useEffect(() => {
    // auto-rotate every 15s, unless the panel is being hovered
    const t = setInterval(() => {
      if (!held.current) go(1);
    }, 15000);
    return () => clearInterval(t);
  }, []);

  const c = CAST[idx];

  return (
    <div
      className={`relative hidden overflow-hidden bg-black sm:block ${className ?? ""}`}
      onMouseEnter={() => {
        held.current = true;
      }}
      onMouseLeave={() => {
        held.current = false;
      }}
    >
      <Image
        src={c.img}
        alt={c.name}
        fill
        sizes="40vw"
        style={{ objectPosition: c.position }}
        className={`object-cover transition-opacity duration-300 ${swapping ? "opacity-0" : "opacity-100"}`}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.6) 80%)",
        }}
      />

      <div
        className={`text-gold absolute top-[7%] right-0 left-0 z-[2] text-center transition-opacity duration-200 ${swapping ? "opacity-0" : "opacity-100"}`}
        style={{
          fontSize: "clamp(32px, 4.5vw, 56px)",
          fontWeight: 800,
          textShadow:
            "0 0 14px rgba(232,212,173,.55), 0 2px 20px rgba(0,0,0,.5)",
        }}
      >
        {c.name}
      </div>

      <div
        className={`absolute top-1/2 right-0 left-0 z-[2] -translate-y-1/2 px-[11%] text-center text-white italic transition-opacity duration-200 ${swapping ? "opacity-0" : "opacity-100"}`}
        style={{
          fontSize: "clamp(16px, 2vw, 23px)",
          fontWeight: 600,
          lineHeight: 1.4,
          textShadow: "0 2px 18px rgba(0,0,0,.55)",
        }}
      >
        {c.quote}
      </div>

      <div className="absolute bottom-[6%] left-[7%] z-[2]">
        <div
          className="text-lg font-bold text-white"
          style={{ textShadow: "0 2px 12px rgba(0,0,0,.5)" }}
        >
          {c.programme}
        </div>
        <div
          className="text-gold mt-0.5 text-sm font-medium"
          style={{ textShadow: "0 2px 10px rgba(0,0,0,.5)" }}
        >
          {c.school}
        </div>
      </div>

      <div
        className="absolute right-[7%] bottom-[6%] z-[2] flex size-[70px] flex-col items-center justify-center rounded-full text-center"
        style={{
          background:
            "radial-gradient(circle at 32% 28%, #fff8ea 0%, #e8d4ad 65%, #d9b87e 100%)",
          border: "1.6px solid rgba(255,255,255,.55)",
          boxShadow: "0 8px 18px rgba(0,0,0,.4)",
          transform: "rotate(-7deg)",
          color: "#0e4a2c",
        }}
      >
        <div className="text-[10px] tracking-wide">★★★★★</div>
        <div className="text-base font-extrabold">{c.rating}</div>
      </div>

      <button
        type="button"
        onClick={() => go(-1)}
        aria-label="Previous"
        className="absolute bottom-4 left-4 z-[3] flex size-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
      >
        <ChevronIcon direction="left" />
      </button>
      <button
        type="button"
        onClick={() => go(1)}
        aria-label="Next"
        className="absolute bottom-4 left-14 z-[3] flex size-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
      >
        <ChevronIcon direction="right" />
      </button>
    </div>
  );
}
