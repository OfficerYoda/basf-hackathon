import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Employees from './pages/Employees'
import EmployeeDetail from './pages/EmployeeDetail'
import CreateEmployee from './pages/CreateEmployee'
import Skills from './pages/Skills'
import CreateSkill from './pages/CreateSkill'
import Heatmap from './pages/Heatmap'
import Wissensbasis from './pages/Wissensbasis'
import CreateArticle from './pages/CreateArticle'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/employees/new" element={<CreateEmployee />} />
          <Route path="/employees/:id" element={<EmployeeDetail />} />
          <Route path="/skills" element={<Skills />} />
          <Route path="/skills/new" element={<CreateSkill />} />
          <Route path="/heatmap" element={<Heatmap />} />
          <Route path="/wissensbasis" element={<Wissensbasis />} />
          <Route path="/wissensbasis/new" element={<CreateArticle />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
