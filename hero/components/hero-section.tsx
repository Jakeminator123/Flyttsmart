import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronRight } from 'lucide-react';

export default function HeroSection() {
  return (
    <>
      <main className="overflow-x-hidden">
        <section>
          <div className="py-24 md:pb-32 lg:pb-36 lg:pt-72">
            <div className="relative mx-auto flex max-w-7xl flex-col px-6 lg:block lg:px-12">
              <div className="mx-auto max-w-lg text-center lg:ml-0 lg:max-w-full lg:text-left">
                <h1 className="font-serif mt-8 max-w-2xl text-balance text-5xl text-white md:text-6xl lg:mt-16 xl:text-7xl font-semibold">
                  Turn ideas into UI in seconds.
                </h1>
                <p className="mt-8 max-w-2xl text-balance text-lg text-white/90">
                  A minimal hero section built with v0 &amp; React Bits animated background. Use it as a starting point for your next project, concept, or experiment.
                </p>

                <div className="mt-12 flex flex-col items-center justify-center gap-2 sm:flex-row lg:justify-start">
                  <Button
                    asChild
                    size="lg"
                    className="h-12 rounded-full pl-5 pr-3 text-base bg-white text-black hover:bg-white/90"
                  >
                    <Link href="https://reactbits.dev/">
                      <span className="text-nowrap">Explore Components</span>
                      <ChevronRight className="ml-1" />
                    </Link>
                  </Button>
                  <Button
                    key={2}
                    asChild
                    size="lg"
                    variant="ghost"
                    className="h-12 rounded-full px-5 text-base text-white bg-white/10 backdrop-blur-md hover:bg-white/20 border border-white/20"
                  >
                    <Link href="https://v0.app/templates/hero-section-with-react-bits-floating-lines-yih2hMiv5q3?ref=8C8WUP">
                      <span className="text-nowrap">Open in v0</span>
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
