import numpy as np
import torch
from PIL import Image
from sentence_transformers import SentenceTransformer

MODEL_ID = "google/embeddinggemma-2"
MODEL_REVISION = "914f7f89142e33e77833254d9c9b90c3cef7303b"
MAX_TOKENS = 8192


class EmbeddingGemma:
    def __init__(self, *, device: str | None = None):
        self.model = SentenceTransformer(
            MODEL_ID,
            revision=MODEL_REVISION,
            device=device,
            config_kwargs={"audio_config": None},
            model_kwargs={"torch_dtype": torch.float32},
            processor_kwargs={"model_max_length": MAX_TOKENS, "truncation_side": "right"},
        )

    def text(self, text: str, *, title: str, query: bool = False) -> np.ndarray:
        if query:
            prefix = "task: search result | query: "
        else:
            tokenizer = self.model[0].tokenizer
            title_tokens = tokenizer.encode(title, add_special_tokens=False)[:128]
            title = tokenizer.decode(title_tokens)
            prefix = f"title: {title} | text: "
        return self._encode(
            prefix + text,
            processing_kwargs={"text": {"max_length": MAX_TOKENS, "truncation": True}},
        )

    def image(self, image: Image.Image | list[Image.Image]) -> np.ndarray:
        if isinstance(image, list):
            processor = self.model[0].processor
            counts = processor._get_num_multimodal_tokens(
                image_sizes=[(picture.height, picture.width) for picture in image]
            ).num_image_tokens
            tokens = processor.tokenizer.num_special_tokens_to_add()
            selected = []
            for picture, count in zip(image, counts, strict=True):
                # The pinned chat template joins images; each has begin/end tokens.
                tokens += count + 2
                if tokens > MAX_TOKENS:
                    break
                selected.append(picture)
            if not selected:
                raise ValueError("No image fits within the model input limit")
            image = selected
        return self._encode({"image": image})

    def video(self, frames: np.ndarray) -> np.ndarray:
        return self._encode(
            {"video": frames},
            processing_kwargs={"video": {"do_sample_frames": False}},
        )

    def _encode(
        self, value: str | dict[str, Image.Image | list[Image.Image] | np.ndarray], **kwargs
    ) -> np.ndarray:
        vector = self.model.encode(
            value,
            normalize_embeddings=True,
            show_progress_bar=False,
            **kwargs,
        )
        if self.model.device.type == "mps":
            torch.mps.empty_cache()
        return vector


def create(*, device: str | None = None) -> EmbeddingGemma:
    return EmbeddingGemma(device=device)
