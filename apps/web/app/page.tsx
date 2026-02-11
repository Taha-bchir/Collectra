"use client"
import { Navbar } from "@/components/common/navbar"
import { HomePageContent } from "@/features/site/components/HomePageContent"
import { Footer } from "@/components/common/footer"

export default function HomePage() {

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HomePageContent />
      <Footer />
    </div>
  )
}
