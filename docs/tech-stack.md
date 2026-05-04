# Tech Stack Cua Project PCShop

Tai lieu nay tong hop cac cong nghe, framework, thu vien va ha tang duoc khai bao truc tiep trong repository hien tai. Danh sach duoi day bao gom dependency trong `package.json`, `pom.xml`, `requirements.txt`, `docker-compose.yml`, Dockerfile va manifest Kubernetes.

## 1. Kien truc tong the
- Microservices.
- API Gateway.
- Service Discovery voi Eureka.
- AI Agentic service theo huong RAG va Multi-Agent System.
- ReAct cho quy trinh suy luan cua agent.
- Containerization voi Docker va Docker Compose.
- Trien khai/quan ly voi Kubernetes.

## 2. Frontend

### Core
- Vite 5.4.19.
- React 18.3.1.
- React DOM 18.3.1.
- TypeScript 5.8.3.
- React Router DOM 6.30.1.

### State, form va data fetching
- TanStack React Query 5.83.0.
- React Hook Form 7.61.1.
- @hookform/resolvers 3.10.0.
- Zod 3.25.76.
- Axios 1.13.6.

### UI, layout va visualization
- Tailwind CSS 3.4.17.
- shadcn/ui.
- Radix UI primitives: accordion, alert-dialog, aspect-ratio, avatar, checkbox, collapsible, context-menu, dialog, dropdown-menu, hover-card, label, menubar, navigation-menu, popover, progress, radio-group, scroll-area, select, separator, slider, slot, switch, tabs, toast, toggle, toggle-group, tooltip.
- class-variance-authority 0.7.1.
- clsx 2.1.1.
- tailwind-merge 2.6.0.
- tailwindcss-animate 1.0.7.
- Lucide React 0.462.0.
- Sonner 1.7.4.
- Recharts 2.15.4.
- date-fns 3.6.0.
- Embla Carousel React 8.6.0.
- cmdk 1.1.1.
- next-themes 0.3.0.
- Vaul 0.9.9.
- react-day-picker 8.10.1.
- react-resizable-panels 2.1.9.
- input-otp 1.4.2.
- file-saver 2.0.5.
- exceljs 4.4.0.
- xlsx 0.18.5.

### Tooling va test
- Node.js 24-alpine trong frontend Docker build.
- npm.
- @vitejs/plugin-react-swc 3.11.0.
- ESLint 9.32.0.
- @eslint/js 9.32.0.
- eslint-plugin-react-hooks 5.2.0.
- eslint-plugin-react-refresh 0.4.20.
- typescript-eslint 8.38.0.
- Vitest 3.2.4.
- @testing-library/react 16.0.0.
- @testing-library/jest-dom 6.6.0.
- JSDOM 20.0.3.
- PostCSS 8.5.6.
- Autoprefixer 10.4.21.
- @tailwindcss/typography 0.5.16.
- @types/node 22.16.5.
- @types/react 18.3.23.
- @types/react-dom 18.3.7.

## 3. Backend Java / Microservices

### Nen tang chung
- Java 21.
- Spring Boot 3.4.3.
- Spring Cloud 2024.0.1.
- Maven va Maven Wrapper.
- Lombok.
- JJWT (0.11.5 va 0.12.5 tuy service).
- Jakarta Validation API.

### Cac service chinh
- api-gateway: Spring Cloud Gateway, Spring Cloud Netflix Eureka Client, Actuator, JJWT. Gateway chay reactive stack qua Spring Cloud Gateway / WebFlux.
- eureka-service: Spring Cloud Netflix Eureka Server.
- auth-service: Spring Web, Spring Data MongoDB, Spring Validation, Spring Mail, Spring Security, Eureka Client, JJWT.
- user-service: Spring Web, Spring Data MongoDB, Spring Security, Spring Validation, Eureka Client, Actuator, Spring Security Test.
- product-service: Spring Web, Spring Data MongoDB, Spring Validation, Eureka Client, OpenFeign, Actuator, Spring Cache, Caffeine.
- order-service: Spring Web, Spring Data MongoDB, Spring Data Redis, Spring Validation, Eureka Client, OpenFeign, Resilience4j, Actuator.
- payment-service: Spring Web, Spring Data MongoDB, Spring Validation, Eureka Client, OpenFeign, Actuator.

### Data, auth va tich hop
- MongoDB.
- MongoDB Atlas.
- Redis 7.
- JWT.
- SMTP / email.
- OpenFeign.
- Resilience4j.
- Caffeine cache.
- Spring Boot Actuator.

### Build va runtime image
- Maven 3.9 + Eclipse Temurin 21.
- Eclipse Temurin 21 JRE.
- Redis 7-alpine.

## 4. Agentic RAG Service (Python)

### Core
- Python 3.11.
- FastAPI 0.116.1.
- Uvicorn[standard] 0.35.0.
- Pydantic 2.11.7.
- pydantic-settings 2.10.1.
- python-dotenv 1.0.1.
- httpx 0.27.2.

### AI / retrieval
- LiteLLM 1.74.8.
- SmolAgents 1.14.0.
- Sentence-Transformers 3.0.1.
- PyMongo 4.10.1.
- DuckDuckGo Search 6.3.7.
- MongoDB Atlas Search (full-text + vector search theo README cua service).

### Kien truc AI
- Multi-Agent System.
- Orchestrator Agent.
- DB Retrieval Agent.
- Web Retrieval Agent.
- ReAct.
- RAG.

### Deployment
- python:3.11-slim.
- Uvicorn server.

## 5. Ha tang va DevOps
- Docker.
- Docker Compose.
- Kubernetes manifests.
- Nginx.
- PowerShell cho smoke test va script van hanh cua agentic service.
- Redis service trong compose/Kubernetes.
- Health check endpoints cho cac service.

## 6. Tom tat nhanh
- Frontend: Vite, React, TypeScript, Tailwind CSS, shadcn/ui.
- Backend: Spring Boot, Spring Cloud, MongoDB, Redis, Eureka, Gateway, OpenFeign, Security, Actuator.
- AI service: FastAPI, Python 3.11, LiteLLM, SmolAgents, Sentence-Transformers, MongoDB Atlas Search.
- Deployment: Docker, Docker Compose, Kubernetes, Nginx.

---

Ghi chu: danh sach nay uu tien cac cong nghe duoc khai bao truc tiep trong repo; khong liet ke toan bo dependency transitive ma cac package manager keo theo.
