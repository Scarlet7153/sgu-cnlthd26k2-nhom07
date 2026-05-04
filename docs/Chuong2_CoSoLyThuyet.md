# Chương 2 — Cơ Sở Lý Thuyết (Tìm hiểu công nghệ)

## 2.1 Mục tiêu chương

Chương này trình bày các khái niệm, công nghệ và kiến trúc chính được sử dụng trong dự án. Mục tiêu là:

- Giải thích vai trò của từng thành phần công nghệ (frontend, backend, cơ sở dữ liệu, hạ tầng). 
- Nêu lý do lựa chọn các công nghệ cụ thể cho yêu cầu của hệ thống (thương mại điện tử + tư vấn build PC + chatbot hỗ trợ).
- Cung cấp nền tảng kỹ thuật cho các phần thiết kế và triển khai ở các chương sau.

## 2.2 Tổng quan kiến trúc hệ thống

Dự án được triển khai theo kiến trúc microservices kết hợp một ứng dụng frontend đơn trang (SPA). Kiến trúc tổng quát gồm:

- Frontend: SPA React + TypeScript (Vite) chịu trách nhiệm giao diện người dùng, điều hướng, gọi API và hiển thị kết quả từ các microservice.
- Backend: Nhiều microservice (e.g., `auth-service`, `user-service`, `product-service`, `order-service`, `payment-service`) triển khai bằng Spring Boot (Java) và được đăng ký/khám phá qua Eureka. Có thêm `api-gateway` (API Gateway) để điều phối, cân bằng tải và áp dụng chính sách bảo mật.
- Cơ sở dữ liệu & cache: MongoDB (tài liệu hóa) cho dữ liệu chính (users, products, orders, payments), Redis dùng cho cart/session/caching.
- Hạ tầng dev/local: Docker + Docker Compose để phối hợp các dịch vụ, cùng với healthchecks và biến môi trường.
- (Tùy chọn) Hệ thống chatbot/RAG: nếu tích hợp sẽ sử dụng vector embedding cho retrieval và một orchestrator để kết hợp kết quả tìm kiếm, luật nghiệp vụ, rồi gọi LLM để tổng hợp trả lời.

Kiến trúc này cho phép:
- Tách rời trách nhiệm (separation of concerns) giữa từng service.
- Triển khai độc lập, mở rộng theo từng service.
- Thử nghiệm và phát triển cục bộ bằng Docker Compose.

## 2.3 Frontend — Công nghệ và thiết kế

### 2.3.1 Ngôn ngữ & framework
- React (v18) + TypeScript: cung cấp khả năng viết UI có kiểu tĩnh, tăng tính an toàn khi phát triển, dễ refactor và tích hợp tốt với tooling hiện đại.
- Vite: bundler dev-server hiện đại, khởi động nhanh và build tối ưu cho project TypeScript + React.

### 2.3.2 Thư viện UI & component
- Tailwind CSS: utility-first CSS giúp phát triển giao diện nhanh, dễ tổ chức theme và responsive.
- Radix UI (trong dự án dùng nhiều package @radix-ui/*): cung cấp primitives accessibility-ready cho các component nâng cao.
- Lucide/Icons: thư viện icon nhẹ, nhất quán cho giao diện.

### 2.3.3 Quản lý dữ liệu & trạng thái
- TanStack Query (React Query): quản lý state dữ liệu bất đồng bộ từ server, caching, refetch, và đồng bộ trạng thái UI.
- Context API + custom hooks (ví dụ: `AuthContext`, `CartContext`, `OrderContext`): quản lý state ứng dụng mang tính domain (phiên đăng nhập, giỏ hàng, v.v.).

### 2.3.4 HTTP client & validation
- Axios: gọi REST API từ frontend.
- React Hook Form + Zod/@hookform/resolvers: quản lý form hiệu năng cao và validate dữ liệu phía client.

### 2.3.5 Testing & linting
- Vitest: unit/integration test cho các component và hooks.
- ESLint: kiểm soát chất lượng mã nguồn và style.

### 2.3.6 Lý do chọn
- Hiệu năng dev cao (Vite), type-safety (TypeScript), UI tiện dụng (Tailwind + Radix), dễ maintain và mở rộng cho ứng dụng thương mại điện tử có nhiều view và trạng thái.

## 2.4 Backend — Công nghệ và thiết kế

### 2.4.1 Ngôn ngữ & framework
- Java (OpenJDK 21) + Spring Boot (3.x): framework mạnh mẽ cho xây dựng microservices, có hệ sinh thái phong phú (Spring Data, Actuator, Security, Cloud).
- Maven: công cụ quản lý build/dependency tiêu chuẩn cho Java.

### 2.4.2 Thành phần microservices chính
- Eureka (Discovery Service): đăng ký và khám phá các service trong hệ thống.
- API Gateway: định tuyến các request tới service tương ứng, có thể thêm lớp xác thực/giới hạn tốc độ (rate limiting), logging, và TLS termination ở tầng ngoài.
- auth-service: xác thực, phát hành JWT (access + refresh), quản lý quyền (roles).
- user-service, product-service, order-service, payment-service: phân tách domain, mỗi service quản lý dữ liệu riêng và expose REST API.

### 2.4.3 Datastores & caching
- MongoDB (Atlas connection in docker-compose): database chủ yếu dạng document, phù hợp lưu trữ sản phẩm có nhiều trường đặc tả (specs_raw, embedding_vector, v.v.).
- Redis: lưu tạm cart, session, dùng làm cache khi cần tối ưu hiệu năng đọc.

### 2.4.4 Inter-service communication
- REST + OpenFeign: giao tiếp giữa services qua HTTP; OpenFeign giúp khai báo client dựa trên interface.
- Eureka: cho phép service discovery thay vì config tĩnh các URL.

### 2.4.5 Logs, health & monitoring
- Spring Actuator: cung cấp health endpoints, metrics, thông tin runtime.
- Logging (SLF4J/Logback): thu thập log ứng dụng; có thể forward sang ELK/Prometheus/Grafana trong môi trường production.

### 2.4.6 Lý do chọn
- Spring Boot cung cấp tốc độ phát triển cao với các starter (data, web, actuator), ecosystem mạnh cho microservices, dễ tích hợp với MongoDB/Redis và công cụ cloud-native.

## 2.5 Mô hình dữ liệu (Tóm tắt theo tài liệu thiết kế)

- MongoDB dùng collections: `accounts`, `refresh_tokens`, `products`, `categories`, `orders`, `payments`, `reviews`.
- `products` chứa trường đặc tả chi tiết (`specs_raw`) và hỗ trợ trường embedding (`embedding_vector`) để phục vụ các truy vấn truy xuất thông minh (semantic search / RAG).
- `orders.items[]` thiết kế snapshot (lưu tên/giá/ảnh tại thời điểm đặt) để đảm bảo tính bất biến lịch sử đơn hàng.
- Cart lưu trên Redis (key `cart:{account_id}`) để thao tác nhanh và tiết kiệm I/O cho order flow.

## 2.6 Bảo mật & xác thực

- Mật khẩu: lưu dưới dạng hash (ví dụ bcrypt) — không lưu plaintext.
- Xác thực: JWT access token + refresh token. Refresh token có thể được lưu vào collection `refresh_tokens` với TTL.
- Truyền tải: dùng HTTPS ở môi trường production; cấu hình CORS tại API Gateway.
- Các biện pháp bổ sung: rate limiting, input validation (Zod ở frontend, Validation annotations ở Spring), sanitize các trường đầu vào để tránh injection.

## 2.7 Triển khai & DevOps

- Dockerfile cho từng microservice và `docker-compose.yml` để chạy stack cục bộ (Redis + Eureka + API Gateway + các service).
- Biến môi trường (env vars) dùng để cấu hình kết nối MongoDB, Redis, Eureka URL, v.v.; các secrets (MongoDB URI, keys) nên lưu trong secret manager (Vault, cloud secret) khi deploy production.
- Healthchecks trong docker-compose giúp orchestration biết service đã sẵn sàng.
- Build pipeline: có thể sử dụng GitHub Actions / GitLab CI để build/maven package, chạy tests và publish image.

## 2.8 Kiểm thử và chất lượng mã nguồn

- Frontend: unit test & component test với Vitest + Testing Library; kiểm tra lint (ESLint).
- Backend: unit/integration test với Spring Boot Test (JUnit), mock các repository/Feign clients.
- Kiểm thử tích hợp: chạy stack bằng Docker Compose trong CI để thực hiện smoke tests (end-to-end minimal flows).

## 2.9 Chatbot AI — Agentic RAG, SmolAgents, LiteLLM và Embeddings

Phần này mô tả chi tiết các thành phần và công nghệ thực tế đã triển khai (hoặc cấu hình) trong repository cho chức năng chatbot dạng Retrieval‑Augmented Generation (RAG). Nội dung chỉ nêu các công nghệ hiện có trong mã nguồn và file cấu hình của dự án; tôi đã loại trừ đề cập tới FastAPI, công cụ tìm web cụ thể và các thư viện phụ theo yêu cầu.

### 2.9.1 Mục tiêu
- Hỗ trợ tư vấn build PC bằng câu trả lời tổng hợp, dựa trên bằng chứng từ catalog sản phẩm.
- Trả về cả phần gợi ý cấu hình chính (`primaryBuild`) và các lựa chọn thay thế theo slot (`alternativesBySlot`).
- Giữ trace hành động để dễ debug và đánh giá chất lượng kết quả.

### 2.9.2 Kiến trúc trung tâm (những thành phần có trong repo)
- Frontend gửi yêu cầu chat (ví dụ payload gồm `sessionId`, `query`, `context`) đến endpoint chat của dịch vụ Agentic RAG.
- Orchestrator Agent (Agentic RAG): code chính nằm tại `backend/agentic-rag-service/app/agents/orchestrator.py`. Orchestrator thực hiện vòng lặp kiểu ReAct (Thought → Action → Observation), điều phối các agent nội bộ, áp dụng luật nghiệp vụ (budget/compatibility) và yêu cầu tổng hợp từ LLM.
- DB Retrieval Agent: cài đặt tại `backend/agentic-rag-service/app/agents/db_retrieval_agent.py`; agent này dùng embedding để tạo vector truy vấn rồi gọi hàm hybrid search từ `backend/agentic-rag-service/app/services/mongo_search_service.py`.
- LLM gateway: lớp trừu tượng hóa gọi model nằm ở `backend/agentic-rag-service/app/services/llm_gateway.py` và sử dụng thư viện `litellm` (LiteLLM) theo cấu hình môi trường để thực hiện generation.
- SmolAgents (tùy chọn): adapter `backend/agentic-rag-service/app/services/smolagent_adapter.py` tích hợp `smolagents.CodeAgent` như một tùy chọn để sinh note kế hoạch (planning) trước khi retrieval — bật/tắt qua biến môi trường `ENABLE_SMOLAGENTS`.

### 2.9.3 Embeddings (đã triển khai)
- Dự án dùng `sentence-transformers` để sinh embedding (được thể hiện bằng `backend/agentic-rag-service/requirements.txt` và lớp `EmbeddingService` tại `backend/agentic-rag-service/app/services/embedding_service.py`).
- Mẫu model embedding mặc định cấu hình trong `.env.example` là `VoVanPhuc/sup-SimCSE-VietNamese-phobert-base` (biến `EMBEDDING_MODEL`).
- Embedding được lưu trong trường chỉ định (`EMBEDDING_FIELD` theo `.env.example`) của tài liệu sản phẩm (ví dụ `products.embedding_vector`).

### 2.9.4 Tìm kiếm ngữ nghĩa & truy vấn lai (hybrid)
- Service `MongoSearchService` (`backend/agentic-rag-service/app/services/mongo_search_service.py`) thực hiện hybrid search bằng cách chạy pipeline text search và vector search (dùng các stage `$search` và `$vectorSearch` của MongoDB Atlas) sau đó hợp thành ranked list.
- Trọng số kết hợp giữa điểm văn bản và điểm vector được cấu hình bởi biến `TEXT_SCORE_WEIGHT` / `VECTOR_SCORE_WEIGHT` trong file môi trường.

### 2.9.5 ReAct loop & chính sách điều phối
- Orchestrator thực thi ReAct-style loop, có cấu hình vòng lặp và timeout (các biến như `REACT_MAX_ITERATIONS`, `REACT_TIMEOUT_SECONDS`, `MIN_DB_EVIDENCE_COUNT` trong `.env.example`).
- Trong quá trình này, orchestrator ưu tiên bằng chứng từ DB (internal retrieval), áp dụng các luật cân bằng ngân sách/compatibility và cuối cùng gọi LLM để tổng hợp câu trả lời có format cố định (ví dụ yêu cầu output rõ ràng, plain-text, kèm citations).

### 2.9.6 Luật nghiệp vụ & cấu trúc kết quả
- Mã nguồn `orchestrator.py` chứa nhiều helper để chọn `primaryBuild`, nhóm `alternativesBySlot`, ước tính `estimatedBuildTotal` và trả về `budgetStatus` — logic này chịu trách nhiệm đảm bảo các giới hạn theo mục đích (ví dụ: office vs gaming) và tỷ lệ phân bổ ngân sách giữa các slot.

### 2.9.7 LiteLLM (trừu tượng LLM)
- Dự án dùng `litellm` (LiteLLM) làm lớp gọi model (được liệt kê trong `requirements.txt`).
- `LLMGateway.generate(...)` trong `app/services/llm_gateway.py` là điểm tích hợp chính; code cũng hỗ trợ cơ chế nhận diện tiền tố model (ví dụ model bắt đầu bằng `ollama/`) để xử lý một số provider theo cách đặc thù.

### 2.9.8 Quy trình dữ liệu (ETL cho embeddings)
- Quy trình đề xuất: làm sạch `specs_raw`/`description_html`, chunk văn bản nếu cần, sinh embedding bằng `EmbeddingService`, lưu vector vào trường `EMBEDDING_FIELD` và cập nhật index trên MongoDB Atlas.
- Các biến index và collection liên quan được cấu hình trong `.env.example` (ví dụ `ATLAS_TEXT_INDEX`, `ATLAS_VECTOR_INDEX`, `MONGODB_PRODUCT_COLLECTION`).

### 2.9.9 Giám sát, trace và kiểm thử
- Orchestrator tạo trace hành động (iterations, actions) và service trả về trace trong response để hỗ trợ debug và đánh giá chất lượng retrieval / reasoning.
- Repo có cấu trúc test và scripts mẫu để chạy smoke tests; các metric cần theo dõi gồm latency, số vòng ReAct, tỉ lệ fallback và độ chính xác evidence.

### 2.9.10 Kết luận & khuyến nghị ngắn
- Các công nghệ thực tế trong repo cho chatbot gồm: Agentic RAG (orchestrator + agents), vòng lặp ReAct, SmolAgents adapter, LiteLLM (litellm), `sentence-transformers` cho embedding và hybrid retrieval dựa trên MongoDB Atlas vector/text search.
- Kiểm tra cấu hình `.env.example` trước khi chạy (embedding model, index names, LiteLLM model/api config, biến bật SmolAgents). Cân nhắc chạy quy trình indexing cho toàn bộ catalog trước khi dùng chức năng RAG để đảm bảo chất lượng retrieval.

Nếu bạn muốn, tôi có thể: (1) chèn vào báo cáo những trích dẫn file (file + dòng) làm chứng cứ, (2) thêm ví dụ code cho pipeline tạo embedding, hoặc (3) tách phần này thành một trang riêng trong `docs/`.

## 2.10 Tổng kết

Chương này mô tả nền tảng công nghệ và các quyết định kỹ thuật cho dự án. Lựa chọn React + TypeScript cho frontend và Spring Boot + MongoDB cho backend phù hợp với yêu cầu một ứng dụng thương mại điện tử có nhiều dữ liệu sản phẩm dạng document, nhu cầu mở rộng và tích hợp nhiều service. Các công nghệ hỗ trợ (Redis, Docker, Eureka, Vite, Tailwind, TanStack Query, v.v.) đều góp phần tăng tốc độ phát triển, hiệu năng chạy và khả năng bảo trì.

---

*Ghi chú:* nếu bạn muốn, tôi có thể:

- Mở rộng từng mục thành các phần con chi tiết hơn (ví dụ: hướng dẫn cài đặt Vite, flow đăng ký JWT, mẫu API sản phẩm). 
- Chia file ra làm nhiều phần để gửi dần (nếu muốn tránh token limit). 
- Thêm hình ảnh minh họa kiến trúc (diagram) hoặc tham chiếu cụ thể đến các file cài đặt trong repo.
