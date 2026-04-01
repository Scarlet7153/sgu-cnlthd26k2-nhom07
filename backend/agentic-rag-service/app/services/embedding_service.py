from typing import List


class EmbeddingService:
    def __init__(self, model_name: str) -> None:
        self.model_name = model_name
        self._model = None

    def _load(self) -> None:
        if self._model is None:
            from sentence_transformers import SentenceTransformer

            self._model = SentenceTransformer(self.model_name)

    def embed(self, text: str) -> List[float]:
        self._load()
        vector = self._model.encode(text, normalize_embeddings=True)
        return vector.tolist()
