import LandingNavbar from '../../components/landing/LandingNavbar'
import LandingHero from '../../components/landing/LandingHero'
import FeaturesSection from '../../components/landing/FeaturesSection'
import ModulesSection from '../../components/landing/ModulesSection'
import PricingSection from '../../components/landing/PricingSection'
import SecuritySection from '../../components/landing/SecuritySection'
import FAQAccordion from '../../components/landing/FAQAccordion'
import LandingFooter from '../../components/landing/LandingFooter'

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-gray-900">
      <LandingNavbar />
      <main className="flex-1">
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
          <LandingHero />
        </div>
        <FeaturesSection />
        <ModulesSection />
        <PricingSection />
        <SecuritySection />
        <FAQAccordion />
      </main>
      <LandingFooter />
    </div>
  )
}
