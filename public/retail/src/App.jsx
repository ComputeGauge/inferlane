function App() {
  const route = useRoute();
  return (
    <div>
      <Nav />
      <main>
        {route === 'home' && (<><HomeHero /><HomeSections /></>)}
        {route === 'earn' && <EarnPage />}
        {route === 'how' && <HowPage />}
        {route === 'why' && <WhyPage />}
        {route === 'product' && <ProductPage />}
        {route === 'tech' && <TechPage />}
        {route === 'install' && <InstallPage />}
        {route === 'run-a-node' && <RunANodePage />}
        {route === 'community' && <CommunityPage />}
        {route === 'roadmap' && <RoadmapPage />}
        {route === 'marketplace' && <MarketplacePage />}
        {route === 'transparency' && <TransparencyPage />}
        {route === 'faq' && <FAQPage />}
        {route === 'aup' && <AupPage />}
        {route === 'operator-agreement' && <OperatorAgreementPage />}
        {route === 'code-of-conduct' && <CodeOfConductPage />}
        {route === 'dashboard' && <DashboardRoute />}
        {route === 'login' && <DashboardRoute />}
        {route === 'start' && (<section className="section" style={{ paddingTop: 80 }}><div className="wrap"><GetStartedPanel /></div></section>)}
        {route === 'waitlist' && (<section className="section" style={{ paddingTop: 80 }}><div className="wrap"><GetStartedPanel /></div></section>)}
        {route === 'terms' && <TermsPage />}
        {route === 'privacy' && <PrivacyPage />}
        {route === 'security' && <SecurityPage />}
        {route === 'cookies' && <CookiesPage />}
      </main>
      <Footer />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
