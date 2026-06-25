"""Seed Synapse with a small sample knowledge base.

Run once after install so the 3D Mind Palace and chat have content to show:

    python seed.py
"""
from __future__ import annotations

from app.core.database import SessionLocal, init_db
from app.models.document import Document
from app.services.ingest import ingest

SAMPLE_DOCS: list[tuple[str, str]] = [
    (
        "Neural Networks & Deep Learning",
        """
A neural network is a model loosely inspired by the brain. It is built from layers
of artificial neurons. Each neuron computes a weighted sum of its inputs, adds a
bias, and passes the result through an activation function such as ReLU or sigmoid.
Stacking many layers produces a deep neural network capable of learning rich
representations.

Training a neural network means adjusting its weights to reduce a loss function.
The loss function measures how far predictions are from the true labels. Gradient
descent updates the weights in the direction that reduces the loss. The gradient is
computed efficiently using backpropagation, which applies the chain rule from the
output layer back to the input layer.

Backpropagation and gradient descent work together: backpropagation computes the
gradient of the loss with respect to every weight, and gradient descent uses that
gradient to take a step. The learning rate controls the size of each step. A learning
rate that is too large causes the loss to diverge, while one that is too small makes
training slow. Optimizers such as Adam adapt the learning rate per weight.

Overfitting happens when a neural network memorizes the training data instead of
learning general patterns. Regularization techniques such as dropout, weight decay,
and early stopping reduce overfitting and improve generalization on unseen data.
""",
    ),
    (
        "Photosynthesis",
        """
Photosynthesis is the process by which plants, algae, and some bacteria convert light
energy into chemical energy. It takes place mainly in the chloroplasts, which contain
the green pigment chlorophyll. Chlorophyll absorbs light most strongly in the blue and
red parts of the spectrum.

Photosynthesis has two stages. The light-dependent reactions occur in the thylakoid
membranes and use light energy to split water, releasing oxygen and producing ATP and
NADPH. The light-independent reactions, also called the Calvin cycle, occur in the
stroma and use ATP and NADPH to fix carbon dioxide into glucose.

The overall reaction combines carbon dioxide and water, powered by light energy, to
produce glucose and oxygen. Glucose stores chemical energy that the plant uses for
growth and respiration. Photosynthesis is the foundation of most food chains and is
responsible for the oxygen in the atmosphere.

The rate of photosynthesis depends on light intensity, carbon dioxide concentration,
and temperature. When any of these factors is in short supply it becomes the limiting
factor that caps the overall rate.
""",
    ),
    (
        "The French Revolution",
        """
The French Revolution began in 1789 and transformed France from an absolute monarchy
into a republic. Its causes included financial crisis, food shortages, an unfair tax
system, and Enlightenment ideas about liberty and equality. King Louis XVI struggled to
manage the national debt and called the Estates-General for the first time in over a
century.

The storming of the Bastille in July 1789 became the symbol of the revolution. The
National Assembly abolished feudal privileges and adopted the Declaration of the Rights
of Man and of the Citizen, which proclaimed liberty, equality, and popular sovereignty.

The revolution grew more radical. The monarchy was abolished and Louis XVI was executed
in 1793. The Reign of Terror, led by Maximilien Robespierre and the Committee of Public
Safety, executed thousands suspected of opposing the revolution. The Terror ended when
Robespierre himself was executed in 1794.

The French Revolution spread ideas of nationalism, citizenship, and democracy across
Europe. It eventually gave rise to Napoleon Bonaparte, who seized power and reshaped
the continent through war and law.
""",
    ),
    (
        "Cell Biology Basics",
        """
The cell is the basic unit of life. Cells are classified as prokaryotic or eukaryotic.
Prokaryotic cells, such as bacteria, lack a nucleus and membrane-bound organelles.
Eukaryotic cells, found in plants and animals, contain a nucleus that stores DNA and a
variety of organelles.

The mitochondria are the powerhouse of the cell, producing ATP through cellular
respiration. Respiration breaks down glucose in the presence of oxygen to release
energy. In this way respiration is complementary to photosynthesis, which builds glucose
using light energy.

The cell membrane controls what enters and leaves the cell. The nucleus contains
chromosomes made of DNA, which carries the genetic instructions for building proteins.
Ribosomes read messenger RNA and assemble proteins from amino acids.

Cells divide through mitosis, producing two identical daughter cells for growth and
repair. Errors in cell division and DNA can lead to mutations, some of which cause
disease.
""",
    ),
]


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        if db.query(Document).count() > 0:
            print("Database already has documents — skipping seed.")
            return
        for title, text in SAMPLE_DOCS:
            doc = ingest(db, title=title, pages=[(None, text)], source_type="text")
            print(f"  + {doc.title}  ({doc.chunk_count} chunks)")
        print("Seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
