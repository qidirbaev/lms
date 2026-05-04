import random
import uuid
from datetime import datetime, timezone

POSITIVE_TEXTS = [
    "Domla darsni juda yaxshi tushuntiradi, barcha savollarimizga sabr bilan javob beradi.",
    "Kurs materiallari to'liq va foydali. Rahmat!",
    "Amaliy mashg'ulotlar juda foydali. Nazariyani amaliyot bilan bog'lash yaxshi.",
    "O'qituvchi tajribali va bilimli. Darslar chuqur va muvozanatli o'tadi.",
    "Zo'r o'qituvchi! Darslarni qiziqarli qiladi, talabalarni rag'batlantiradi.",
]

NEGATIVE_TEXTS = [
    "Domla tushunarsiz gapiradi. Darsdan keyin ham savollarimga javob bermaydi.",
    "Baholashda adolatsizlik bor. Ayrim talabalar ko'p ball olsa-da, bilim darajasi past.",
    "Imtihon savollari dars materiallari bilan mos kelmaydi.",
    "Platforma ishlashda muammolar bor, tez-tez uzilib qoladi.",
    "Domla vaqtida darsga kelmaydi. Bu talabalar vaqtiga hurmatisizlik.",
]

NEUTRAL_TEXTS = [
    "Darslar qiziqarli, lekin materiallar eskirgan. Yangi adabiyotlar qo'shilsa yaxshi bo'lar edi.",
    "Dars o'tkaziladigan xona noqulay, lekin tushuntirishlar yaxshi.",
    "Material chuqur va qiziqarli. Faqat sur'at biroz tez.",
    "Guruhda talabalar ko'p, individual e'tibor etarli emas.",
    "Darslar online rejimda o'tkazilganda sifat pasayadi.",
]

RISK_TEXTS = [
    "Ba'zi talabalar imtihonda aldagani ko'rindi, lekin domla e'tibor bermadi.",
    "Ballarni boshqacha hisoblayapti deb o'ylayman. Shaffoflik yo'q.",
    "Talabalarga nisbatan adolatli munosabat yo'q. Sevimli va sevmaydigan talabalar.",
    "Ba'zi talabalar imtihonda o'zaro yordam oldi va domla buni ko'rmadi.",
]

ISSUE_TEXTS = {
    "teaching_style": [
        "Domla'ning dars o'tkazish uslubi eskirgan. Yangi metodlarni qo'llash kerak.",
        "Tushuntirish uslubi talabalar darajasiga mos emas.",
    ],
    "content_quality": [
        "Darslik eski va dolzarb emas. Yangi manbalar bilan to'ldirilsin.",
        "Kurs dasturi zamonaviy talab darajasida emas.",
    ],
    "assessment": [
        "Imtihon tartibi noaniq. Mezonlar oldindan ma'lum qilinmagan.",
        "Baholash adolatli emas, shikoyat qilmoqchi edim.",
    ],
    "technical_issue": [
        "Online platforma tez-tez ishlamay qoladi. Texnik muammo hal qilinsin.",
        "Video darslar sifati past, ovoz tushib qoladi.",
    ],
}

COURSES = [
    ("MATH-101", "Calculus I"), ("CS-101", "Programming Fundamentals"),
    ("CS-201", "Algorithms"), ("PHYS-101", "Physics I"),
    ("ECON-101", "Microeconomics"), ("CS-301", "Database Systems"),
    ("CS-401", "Machine Learning"), ("ENG-101", "Technical English"),
]

TEACHERS = [
    ("T-01", "Aziz Karimov"), ("T-02", "Nodira Yusupova"),
    ("T-03", "Bobur Toshmatov"), ("T-04", "Zulfiya Rahimova"),
    ("T-05", "Sardor Mirzayev"),
]


def generate_simulated_feedbacks(
    count: int = 5,
    sentiment_style: str = "mixed",
    issue_theme: str = "mixed",
) -> list:
    results = []
    rng = random.Random()

    for i in range(count):
        fid = f"sim-{uuid.uuid4().hex[:8]}"
        course = rng.choice(COURSES)
        teacher = rng.choice(TEACHERS)

        # Pick text based on sentiment_style
        if sentiment_style == "positive":
            raw_text = rng.choice(POSITIVE_TEXTS)
            rating = rng.randint(4, 5)
        elif sentiment_style == "negative":
            if issue_theme != "mixed" and issue_theme in ISSUE_TEXTS:
                raw_text = rng.choice(ISSUE_TEXTS[issue_theme])
            else:
                raw_text = rng.choice(NEGATIVE_TEXTS + RISK_TEXTS)
            rating = rng.randint(1, 2)
        else:
            pool = POSITIVE_TEXTS + NEGATIVE_TEXTS + NEUTRAL_TEXTS
            raw_text = rng.choice(pool)
            rating = rng.randint(2, 5)

        ts = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        item = {
            "schema_version": "1.0.0",
            "feedback_id": fid,
            "content": {
                "raw_text": raw_text,
                "rating": rating,
            },
            "metadata": {
                "course_id": course[0],
                "teacher_id": teacher[0],
                "teacher_fullname": teacher[1],
                "student_context": {
                    "year": rng.randint(1, 4),
                    "gender": rng.choice(["male", "female"]),
                    "group_id": f"{rng.randint(100, 120)}-25",
                    "department": rng.choice(["Computer Science", "Mathematics", "Engineering"]),
                    "course_points": rng.randint(40, 100),
                    "gpa": round(rng.uniform(2.5, 5.0), 2),
                    "attendance_rate": round(rng.uniform(0.5, 1.0), 2),
                },
                "timestamp": ts,
            },
            "feedback_context": {
                "feedback_channel": rng.choice(["weekly_checkin", "end_course_survey", "complaint_form"]),
                "is_anonymous": rng.choice([True, False]),
            },
            "course_context": {
                "course_name": course[1],
                "course_level": "bachelor",
                "course_delivery_mode": rng.choice(["offline", "online", "hybrid"]),
            },
            "teacher_context": {
                "teacher_role": rng.choice(["lecturer", "senior_lecturer", "associate_professor"]),
                "teaching_experience_years": rng.randint(1, 20),
                "teacher_department_id": "DEP-CS",
            },
        }
        results.append(item)

    return results