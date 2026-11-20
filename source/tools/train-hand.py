#!/usr/bin/env python3
"""Train the on-site handwriting reader.

The reader learns letters, not a fixed word list, from open handwriting fonts
and drawn strokes. Photo tags stay in filenames, so a new word does not need
another training run. Fonts are downloaded only while training and are not
shipped with the site.
"""

import argparse
import json
import random
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HEIGHT = 32
MAX_WIDTH = 256
CHARS = "abcdefghijklmnopqrstuvwxyz"
BLANK = 0
ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "web" / "vendor" / "hand"
FONT_DIR = Path("/tmp/hanseo-fonts")
HOLDOUT = set()

WORDS = [
    "sun", "sea", "moon", "night", "rain", "tree", "road", "bird", "hand", "city",
    "snow", "wind", "lake", "star", "fish", "book", "film", "home", "blue", "gold",
    "river", "cloud", "stone", "light", "green", "field", "water", "flower", "garden",
    "summer", "winter", "spring", "shadow", "bridge", "window", "letter", "paper",
    "apple", "orange", "yellow", "purple", "silver", "forest", "mountain", "ocean",
]

LETTERS = {
    "a": [[(0.62, 0.42), (0.38, 0.38), (0.2, 0.55), (0.28, 0.78), (0.52, 0.88), (0.74, 0.72), (0.76, 0.46), (0.76, 0.9)]],
    "b": [[(0.28, 0.08), (0.28, 0.9)], [(0.28, 0.5), (0.52, 0.4), (0.78, 0.55), (0.74, 0.78), (0.48, 0.9), (0.28, 0.74)]],
    "c": [[(0.74, 0.48), (0.52, 0.36), (0.26, 0.52), (0.24, 0.74), (0.48, 0.9), (0.74, 0.78)]],
    "d": [[(0.72, 0.08), (0.72, 0.9)], [(0.72, 0.5), (0.48, 0.38), (0.24, 0.55), (0.26, 0.78), (0.5, 0.9), (0.72, 0.74)]],
    "e": [[(0.28, 0.62), (0.72, 0.58)], [(0.72, 0.5), (0.48, 0.36), (0.24, 0.52), (0.24, 0.74), (0.48, 0.9), (0.74, 0.76)]],
    "f": [[(0.62, 0.16), (0.42, 0.08), (0.34, 0.24), (0.38, 0.92)], [(0.22, 0.48), (0.68, 0.48)]],
    "g": [[(0.7, 0.42), (0.46, 0.36), (0.24, 0.54), (0.28, 0.76), (0.52, 0.88), (0.74, 0.72), (0.74, 1.05), (0.48, 1.18), (0.28, 1.02)]],
    "h": [[(0.26, 0.08), (0.26, 0.9)], [(0.26, 0.55), (0.48, 0.4), (0.72, 0.55), (0.74, 0.9)]],
    "i": [[(0.42, 0.22), (0.46, 0.26)], [(0.44, 0.42), (0.44, 0.9)]],
    "j": [[(0.52, 0.22), (0.56, 0.26)], [(0.54, 0.42), (0.54, 1.05), (0.36, 1.18), (0.22, 1.02)]],
    "k": [[(0.28, 0.08), (0.28, 0.9)], [(0.72, 0.42), (0.32, 0.64)], [(0.42, 0.62), (0.76, 0.9)]],
    "l": [[(0.4, 0.08), (0.38, 0.78), (0.55, 0.9)]],
    "m": [[(0.12, 0.9), (0.12, 0.48), (0.28, 0.36), (0.42, 0.55), (0.42, 0.9)], [(0.42, 0.55), (0.58, 0.36), (0.78, 0.55), (0.8, 0.9)]],
    "n": [[(0.24, 0.9), (0.24, 0.48), (0.46, 0.36), (0.7, 0.52), (0.74, 0.9)]],
    "o": [[(0.5, 0.38), (0.26, 0.52), (0.24, 0.74), (0.48, 0.9), (0.74, 0.74), (0.76, 0.52), (0.5, 0.38)]],
    "p": [[(0.28, 0.42), (0.28, 1.16)], [(0.28, 0.5), (0.52, 0.4), (0.76, 0.55), (0.72, 0.78), (0.46, 0.9), (0.28, 0.74)]],
    "q": [[(0.72, 0.42), (0.72, 1.16)], [(0.72, 0.5), (0.48, 0.38), (0.24, 0.55), (0.26, 0.78), (0.5, 0.9), (0.72, 0.74)]],
    "r": [[(0.28, 0.9), (0.28, 0.42)], [(0.28, 0.55), (0.48, 0.4), (0.7, 0.48)]],
    "s": [[(0.74, 0.4), (0.48, 0.32), (0.26, 0.46), (0.36, 0.6), (0.66, 0.68), (0.74, 0.82), (0.48, 0.94), (0.24, 0.8)]],
    "t": [[(0.46, 0.16), (0.42, 0.78), (0.58, 0.9)], [(0.24, 0.42), (0.7, 0.42)]],
    "u": [[(0.22, 0.42), (0.22, 0.72), (0.4, 0.9), (0.64, 0.9), (0.78, 0.68), (0.78, 0.42)]],
    "v": [[(0.16, 0.42), (0.48, 0.9), (0.8, 0.42)]],
    "w": [[(0.08, 0.42), (0.28, 0.9), (0.48, 0.55), (0.68, 0.9), (0.88, 0.42)]],
    "x": [[(0.2, 0.42), (0.76, 0.9)], [(0.76, 0.42), (0.2, 0.9)]],
    "y": [[(0.18, 0.42), (0.48, 0.78), (0.78, 0.42)], [(0.48, 0.78), (0.42, 1.12)]],
    "z": [[(0.22, 0.42), (0.76, 0.42), (0.24, 0.9), (0.78, 0.9)]],
}


class Reader(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(1, 32, 3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d((2, 2)),
            nn.Conv2d(32, 64, 3, padding=1),
            nn.ReLU(inplace=True),
            nn.MaxPool2d((2, 2)),
            nn.Conv2d(64, 128, (3, 5), padding=(1, 2)),
            nn.ReLU(inplace=True),
            nn.MaxPool2d((8, 1)),
        )
        self.fc = nn.Linear(128, len(CHARS) + 1)

    def forward(self, images):
        features = self.conv(images).squeeze(2).permute(0, 2, 1)
        return self.fc(features)


def densify(points, steps=6):
    dense = []
    for start, end in zip(points, points[1:]):
        for step in range(steps):
            blend = step / steps
            dense.append((start[0] + (end[0] - start[0]) * blend, start[1] + (end[1] - start[1]) * blend))
    dense.append(points[-1])
    return dense


def draw_strokes(word, rng):
    height = rng.randint(78, 120)
    thickness = max(5, int(height * rng.uniform(0.09, 0.16)))
    gap = rng.randint(-thickness // 3, int(height * 0.16))
    slant = rng.uniform(-0.22, 0.08)
    cell_width = int(height * 0.78)
    wide = int(height * 1.15)
    width = 16
    for char in word:
        width += (wide if char in "mw" else cell_width) + gap
    image = Image.new("L", (width + 16, int(height * 1.45)), 255)
    draw = ImageDraw.Draw(image)
    x = 10
    previous = None
    for char in word:
        cell = wide if char in "mw" else cell_width
        top = int(height * 0.12) + rng.randint(-4, 4)
        end = None
        start = None
        for stroke in LETTERS[char]:
            points = []
            for px, py in densify(stroke):
                sx = x + px * cell + py * height * slant + rng.uniform(-1.2, 1.2)
                sy = top + py * height + rng.uniform(-1.2, 1.2)
                points.append((sx, sy))
            if start is None:
                start = points[0]
            end = points[-1]
            draw.line(points, fill=0, width=thickness)
        if previous and rng.random() < 0.55:
            draw.line([previous, start], fill=0, width=max(3, thickness - 2))
        previous = end
        x += cell + gap
    return image


def draw_font(word, font_path, rng):
    size = rng.randint(48, 82)
    font = ImageFont.truetype(str(font_path), size)
    probe = ImageDraw.Draw(Image.new("L", (1, 1), 255))
    box = probe.textbbox((0, 0), word, font=font)
    image = Image.new("L", (box[2] - box[0] + 28, box[3] - box[1] + 28), 255)
    ImageDraw.Draw(image).text((14 - box[0], 14 - box[1]), word, font=font, fill=0)
    return image.rotate(rng.uniform(-6, 6), expand=True, fillcolor=255)


def vary(image, rng):
    if rng.random() < 0.45:
        image = image.filter(ImageFilter.MaxFilter(3))
    elif rng.random() < 0.25:
        image = image.filter(ImageFilter.MinFilter(3))
    values = np.array(image)
    if rng.random() < 0.55:
        values = np.where(values < rng.randint(140, 210), 0, 255).astype(np.uint8)
        image = Image.fromarray(values)
    return image


def fit(image, word):
    values = np.array(image)
    ink = values < 200
    if not ink.any():
        return None
    rows, cols = np.where(ink)
    crop = image.crop((int(cols.min()), int(rows.min()), int(cols.max()) + 1, int(rows.max()) + 1))
    minimum = max(32, (len(word) + 2) * 8)
    minimum = ((minimum + 3) // 4) * 4
    width = max(minimum, min(MAX_WIDTH, int(crop.width * (HEIGHT / max(1, crop.height)))))
    width = min(MAX_WIDTH, ((width + 3) // 4) * 4)
    resized = crop.resize((min(width, MAX_WIDTH), HEIGHT), Image.Resampling.BILINEAR)
    if resized.width > width:
        resized = resized.resize((width, HEIGHT), Image.Resampling.BILINEAR)
    canvas = Image.new("L", (width, HEIGHT), 255)
    canvas.paste(resized, (0, 0))
    return 1.0 - np.asarray(canvas, np.float32) / 255.0


def sample_word(rng):
    roll = rng.random()
    if roll < 0.22:
        return rng.choice(WORDS)
    if roll < 0.55:
        vowels = "aeiou"
        consonants = "bcdfghjklmnpqrstvwxyz"
        count = rng.randint(2, 7)
        return "".join(rng.choice(vowels if index % 2 else consonants) for index in range(count))
    return "".join(rng.choice(CHARS) for _ in range(rng.randint(1, 7)))


def make_sample(rng, fonts):
    word = sample_word(rng)
    if rng.random() < 0.55 or not fonts:
        image = draw_strokes(word, rng)
    else:
        image = draw_font(word, rng.choice(fonts), rng)
    image = vary(image, rng)
    array = fit(image, word)
    if array is None or array.shape[1] // 4 < len(word):
        return make_sample(rng, fonts)
    return word, array


def collate(samples):
    width = max(array.shape[1] for _, array in samples)
    batch = np.zeros((len(samples), 1, HEIGHT, width), np.float32)
    lengths = []
    targets = []
    target_lengths = []
    for index, (word, array) in enumerate(samples):
        batch[index, 0, :, : array.shape[1]] = array
        lengths.append(array.shape[1] // 4)
        targets.extend(CHARS.index(char) + 1 for char in word)
        target_lengths.append(len(word))
    return (
        torch.from_numpy(batch),
        torch.tensor(lengths, dtype=torch.long),
        torch.tensor(targets, dtype=torch.long),
        torch.tensor(target_lengths, dtype=torch.long),
    )


def greedy(logits, length):
    if hasattr(logits, "detach"):
        logits = logits.detach().cpu().numpy()
    text = []
    previous = -1
    confidence = []
    for step in range(length):
        scores = logits[step]
        choice = int(scores.argmax())
        shifted = scores - scores.max()
        probability = float(np.exp(shifted[choice]) / np.exp(shifted).sum())
        confidence.append(probability)
        if choice != BLANK and choice != previous:
            text.append(CHARS[choice - 1])
        previous = choice
    score = 100.0 * (sum(confidence) / len(confidence) if confidence else 0.0)
    return "".join(text), score


def evaluate(model, fonts, device):
    model.eval()
    rng = random.Random(7)
    correct = 0
    total = 80
    shown = []
    with torch.no_grad():
        for index in range(total):
            word, array = make_sample(rng, fonts)
            tensor = torch.from_numpy(array).unsqueeze(0).unsqueeze(0).to(device)
            logits = model(tensor)[0, : array.shape[1] // 4].cpu().numpy()
            text, _ = greedy(torch.from_numpy(logits), array.shape[1] // 4)
            correct += text == word
            if index < 6:
                shown.append(word + "->" + text)
        probes = []
        for word in ("sun", "sea", "night"):
            image = vary(draw_strokes(word, random.Random(3)), random.Random(3))
            array = fit(image, word)
            tensor = torch.from_numpy(array).unsqueeze(0).unsqueeze(0).to(device)
            text, score = greedy(model(tensor)[0].cpu(), array.shape[1] // 4)
            probes.append("%s->%s(%.0f)" % (word, text, score))
    model.train()
    return correct / total, " ".join(shown), " ".join(probes)


def export(model, path):
    path.mkdir(parents=True, exist_ok=True)
    blobs = []
    tensors = []
    for name, value in model.state_dict().items():
        array = value.detach().cpu().contiguous().numpy().astype(np.float32)
        tensors.append({"name": name, "shape": list(array.shape)})
        blobs.append(array.reshape(-1))
    weights = np.concatenate(blobs)
    weights.tofile(path / "weights.bin")
    meta = {"height": HEIGHT, "blank": BLANK, "chars": CHARS, "tensors": tensors}
    (path / "model.json").write_text(json.dumps(meta), encoding="utf-8")
    return weights


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=10)
    parser.add_argument("--steps", type=int, default=120)
    parser.add_argument("--batch", type=int, default=40)
    args = parser.parse_args()
    fonts = sorted(path for path in FONT_DIR.glob("*.ttf") if path.name not in HOLDOUT)
    if not fonts:
        raise SystemExit("No training fonts in " + str(FONT_DIR))
    device = "cpu"
    model = Reader().to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=0.002)
    loss_fn = nn.CTCLoss(blank=BLANK, zero_infinity=True)
    rng = random.Random(1)
    for epoch in range(args.epochs):
        total = 0.0
        for _ in range(args.steps):
            samples = [make_sample(rng, fonts) for _ in range(args.batch)]
            images, lengths, targets, target_lengths = collate(samples)
            images = images.to(device)
            logits = model(images).log_softmax(2).permute(1, 0, 2)
            loss = loss_fn(logits, targets.to(device), lengths.to(device), target_lengths.to(device))
            optimizer.zero_grad()
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 5)
            optimizer.step()
            total += float(loss.item())
        accuracy, samples, probes = evaluate(model, fonts, device)
        print("epoch %d loss %.3f acc %.2f | %s | %s" % (epoch + 1, total / args.steps, accuracy, samples, probes), flush=True)
    model.to("cpu").eval()
    export(model, OUT_DIR)
    holdout = sorted(path for path in FONT_DIR.glob("*.ttf") if path.name in HOLDOUT)
    if holdout:
        accuracy, _, probes = evaluate(model.to(device), holdout, device)
        print("holdout acc %.2f | %s" % (accuracy, probes), flush=True)
    word, array = make_sample(random.Random(11), [])
    with torch.no_grad():
        logits = model.to("cpu")(torch.from_numpy(array).unsqueeze(0).unsqueeze(0))[0, : array.shape[1] // 4]
    text, _ = greedy(logits, array.shape[1] // 4)
    fixture = {
        "width": int(array.shape[1]),
        "input": array.reshape(-1).tolist(),
        "text": text,
    }
    fixture_path = ROOT / "__tests__" / "fixtures"
    fixture_path.mkdir(parents=True, exist_ok=True)
    (fixture_path / "hand-sample.json").write_text(json.dumps(fixture), encoding="utf-8")
    print("saved", OUT_DIR, "sample", word, "->", text, flush=True)


if __name__ == "__main__":
    main()
