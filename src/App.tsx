import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { I18nProvider } from './i18n'
import Home from './routes/Home'
import Stamp from './routes/customer/Stamp'
import Card from './routes/customer/Card'
import Redeem from './routes/customer/Redeem'
import LoginLink from './routes/customer/LoginLink'

const PanelApp = lazy(() => import('./routes/panel/PanelApp'))

export default function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/s/:shopCode" element={<Stamp />} />
            <Route path="/k/:shopCode" element={<Card />} />
            <Route path="/k/:shopCode/use/:grantId" element={<Redeem />} />
            <Route path="/d/:shopCode/:refCode" element={<Card />} />
            <Route path="/g/:token" element={<LoginLink />} />
            <Route path="/panel/*" element={<PanelApp />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </I18nProvider>
  )
}
