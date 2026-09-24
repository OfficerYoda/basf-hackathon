import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Employees from './pages/Employees'
import EmployeeDetail from './pages/EmployeeDetail'
import CreateEmployee from './pages/CreateEmployee'
import EditEmployee from './pages/EditEmployee'
import Skills from './pages/Skills'
import CreateSkill from './pages/CreateSkill'
import SkillDetail from './pages/SkillDetail'
import Wissensbasis from './pages/Wissensbasis'
import ArticleDetail from './pages/ArticleDetail'
import CreateArticle from './pages/CreateArticle'
import EditArticle from './pages/EditArticle'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/employees/new" element={<CreateEmployee />} />
          <Route path="/employees/:id" element={<EmployeeDetail />} />
          <Route path="/employees/:id/edit" element={<EditEmployee />} />
          <Route path="/skills" element={<Skills />} />
          <Route path="/skills/new" element={<CreateSkill />} />
          <Route path="/skills/:name" element={<SkillDetail />} />
          <Route path="/wissensbasis" element={<Wissensbasis />} />
          <Route path="/wissensbasis/new" element={<CreateArticle />} />
          <Route path="/wissensbasis/:id" element={<ArticleDetail />} />
          <Route path="/wissensbasis/:id/edit" element={<EditArticle />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
