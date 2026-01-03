import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import LocalMode from './pages/LocalMode'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<LocalMode />} />
      </Route>
    </Routes>
  )
}

export default App
