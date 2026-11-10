"""Candidate resume upload / list / archive APIs."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path

from docx import Document
from pypdf import PdfWriter

from app.core.config import settings
from app.core.security import hash_password
from app.models.user import Role, User, UserStatus


def _register(
    client,
    email: str,
    password: str = "password1",
    role: str = "candidate",
    full_name: str = "Test User",
):
    return client.post(
        "/auth/register",
        json={
            "email": email,
            "password": password,
            "role": role,
            "full_name": full_name,
        },
    )


def _login(client, email: str, password: str = "password1"):
    return client.post("/auth/login", json={"email": email, "password": password})


def _make_user(
    db_session,
    *,
    email: str,
    role: Role,
    status: UserStatus = UserStatus.active,
    password: str = "password1",
):
    user = User(
        email=email,
        password_hash=hash_password(password),
        role=role,
        status=status,
        auth_provider="local",
        email_verified=True,
    )
    db_session.add(user)
    db_session.commit()
    return user


def _pdf_with_text(text: str = "Hello Backend CV") -> bytes:
    # Minimal PDF with a text drawing operator (pypdf can extract).
    content = f"BT /F1 12 Tf 50 700 Td ({text}) Tj ET"
    stream = content.encode("latin-1")
    objects = [
        b"1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n",
        b"2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n",
        (
            b"3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            b"/Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n"
        ),
        (
            f"4 0 obj<< /Length {len(stream)} >>stream\n".encode()
            + stream
            + b"\nendstream\nendobj\n"
        ),
        b"5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objects:
        offsets.append(len(out))
        out.extend(obj)
    xref_pos = len(out)
    out.extend(f"xref\n0 {len(offsets)}\n".encode())
    out.extend(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        out.extend(f"{off:010d} 00000 n \n".encode())
    out.extend(
        f"trailer<< /Size {len(offsets)} /Root 1 0 R >>\n"
        f"startxref\n{xref_pos}\n%%EOF\n".encode()
    )
    return bytes(out)


def _pdf_blank() -> bytes:
    writer = PdfWriter()
    writer.add_blank_page(width=200, height=200)
    buf = BytesIO()
    writer.write(buf)
    return buf.getvalue()


def _docx_with_text(text: str = "Hello Docx Resume") -> bytes:
    doc = Document()
    doc.add_paragraph(text)
    buf = BytesIO()
    doc.save(buf)
    return buf.getvalue()


def _upload(
    client,
    *,
    title: str,
    filename: str,
    data: bytes,
    content_type: str = "application/octet-stream",
):
    return client.post(
        "/resumes",
        data={"title": title},
        files={"file": (filename, data, content_type)},
    )


def test_upload_pdf_and_docx_extracts_text(client, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    email = "cand-resume@example.com"
    assert _register(client, email).status_code == 201
    assert _login(client, email).status_code == 204

    pdf = _upload(
        client,
        title="Backend CV",
        filename="backend.pdf",
        data=_pdf_with_text("Skillio Backend Engineer"),
        content_type="application/pdf",
    )
    assert pdf.status_code == 201, pdf.text
    body = pdf.json()
    assert body["title"] == "Backend CV"
    assert body["extraction_status"] == "ok"
    assert "stored_filename" not in body
    assert "candidate_id" not in body
    assert "extracted_text" not in body

    detail = client.get(f"/resumes/{body['id']}")
    assert detail.status_code == 200
    assert "Skillio Backend Engineer" in (detail.json()["extracted_text"] or "")

    docx = _upload(
        client,
        title="Frontend CV",
        filename="frontend.docx",
        data=_docx_with_text("React TypeScript Engineer"),
        content_type=(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ),
    )
    assert docx.status_code == 201, docx.text
    detail2 = client.get(f"/resumes/{docx.json()['id']}")
    assert "React TypeScript Engineer" in (detail2.json()["extracted_text"] or "")


def test_fake_extension_and_bad_magic_rejected(client, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    email = "cand-fake@example.com"
    assert _register(client, email).status_code == 201
    assert _login(client, email).status_code == 204

    fake = _upload(
        client,
        title="Fake",
        filename="resume.pdf",
        data=b"this is not a pdf",
        content_type="application/pdf",
    )
    assert fake.status_code == 400

    txt = _upload(
        client,
        title="Txt",
        filename="resume.txt",
        data=b"plain text",
        content_type="text/plain",
    )
    assert txt.status_code == 400


def test_oversize_rejected(client, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    monkeypatch.setattr(settings, "MAX_RESUME_SIZE_MB", 0)
    email = "cand-big@example.com"
    assert _register(client, email).status_code == 201
    assert _login(client, email).status_code == 204

    res = _upload(
        client,
        title="Big",
        filename="big.pdf",
        data=_pdf_with_text(),
        content_type="application/pdf",
    )
    assert res.status_code == 413


def test_max_active_then_archive_allows_new(client, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    monkeypatch.setattr(settings, "MAX_ACTIVE_RESUMES", 3)
    email = "cand-max@example.com"
    assert _register(client, email).status_code == 201
    assert _login(client, email).status_code == 204

    ids = []
    for i in range(3):
        res = _upload(
            client,
            title=f"CV {i}",
            filename=f"cv{i}.pdf",
            data=_pdf_with_text(f"Resume {i}"),
            content_type="application/pdf",
        )
        assert res.status_code == 201, res.text
        ids.append(res.json()["id"])

    fourth = _upload(
        client,
        title="CV 4",
        filename="cv4.pdf",
        data=_pdf_with_text("Resume 4"),
        content_type="application/pdf",
    )
    assert fourth.status_code == 409

    archived = client.post(f"/resumes/{ids[0]}/archive")
    assert archived.status_code == 200
    assert archived.json()["status"] == "archived"

    again = _upload(
        client,
        title="CV after archive",
        filename="cv5.pdf",
        data=_pdf_with_text("Resume 5"),
        content_type="application/pdf",
    )
    assert again.status_code == 201


def test_employer_admin_forbidden_unauth_401(client, db_session, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    client.cookies.clear()
    assert client.get("/resumes").status_code == 401

    emp = _make_user(db_session, email="emp-cv@example.com", role=Role.employer)
    assert _login(client, emp.email).status_code == 204
    assert client.get("/resumes").status_code == 403
    assert (
        _upload(
            client,
            title="Nope",
            filename="x.pdf",
            data=_pdf_with_text(),
            content_type="application/pdf",
        ).status_code
        == 403
    )

    admin = _make_user(db_session, email="admin-cv@example.com", role=Role.admin)
    assert _login(client, admin.email).status_code == 204
    assert client.get("/resumes").status_code == 403


def test_non_owner_gets_404(client, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    assert _register(client, "owner@example.com").status_code == 201
    assert _login(client, "owner@example.com").status_code == 204
    created = _upload(
        client,
        title="Mine",
        filename="mine.pdf",
        data=_pdf_with_text(),
        content_type="application/pdf",
    )
    assert created.status_code == 201
    resume_id = created.json()["id"]

    client.cookies.clear()
    assert _register(client, "other@example.com").status_code == 201
    assert _login(client, "other@example.com").status_code == 204

    assert client.get(f"/resumes/{resume_id}").status_code == 404
    assert client.get(f"/resumes/{resume_id}/file").status_code == 404
    assert (
        client.patch(f"/resumes/{resume_id}", json={"title": "Hack"}).status_code
        == 404
    )
    assert client.post(f"/resumes/{resume_id}/archive").status_code == 404


def test_archive_idempotent_and_list_filters(client, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    email = "cand-list@example.com"
    assert _register(client, email).status_code == 201
    assert _login(client, email).status_code == 204

    created = _upload(
        client,
        title="List CV",
        filename="list.pdf",
        data=_pdf_with_text(),
        content_type="application/pdf",
    )
    resume_id = created.json()["id"]

    a1 = client.post(f"/resumes/{resume_id}/archive")
    a2 = client.post(f"/resumes/{resume_id}/archive")
    assert a1.status_code == 200
    assert a2.status_code == 200
    assert a2.json()["status"] == "archived"
    assert a2.json()["archived_at"] is not None

    active = client.get("/resumes")
    assert active.status_code == 200
    assert active.json() == []

    archived = client.get("/resumes", params={"status": "archived"})
    assert archived.status_code == 200
    assert len(archived.json()) == 1
    assert archived.json()[0]["id"] == resume_id
    assert "extracted_text" not in archived.json()[0]


def test_blank_pdf_empty_extraction_still_201(client, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    email = "cand-blank@example.com"
    assert _register(client, email).status_code == 201
    assert _login(client, email).status_code == 204

    res = _upload(
        client,
        title="Scanned",
        filename="scan.pdf",
        data=_pdf_blank(),
        content_type="application/pdf",
    )
    assert res.status_code == 201
    assert res.json()["extraction_status"] == "empty"
    detail = client.get(f"/resumes/{res.json()['id']}")
    assert detail.json()["extracted_text"] is None


def test_download_file_owner(client, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    email = "cand-dl@example.com"
    assert _register(client, email).status_code == 201
    assert _login(client, email).status_code == 204
    data = _pdf_with_text("Download Me")
    created = _upload(
        client,
        title="DL",
        filename="download me.pdf",
        data=data,
        content_type="application/pdf",
    )
    resume_id = created.json()["id"]
    res = client.get(f"/resumes/{resume_id}/file")
    assert res.status_code == 200
    assert res.content == data
    assert "attachment" in res.headers.get("content-disposition", "").lower()


def test_patch_title(client, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    email = "cand-patch@example.com"
    assert _register(client, email).status_code == 201
    assert _login(client, email).status_code == 204
    created = _upload(
        client,
        title="Old",
        filename="old.pdf",
        data=_pdf_with_text(),
        content_type="application/pdf",
    )
    resume_id = created.json()["id"]
    res = client.patch(f"/resumes/{resume_id}", json={"title": "New Title"})
    assert res.status_code == 200
    assert res.json()["title"] == "New Title"


def test_upload_rate_limit_429(client, tmp_path, monkeypatch, enable_rate_limiting):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    monkeypatch.setattr(settings, "RESUME_UPLOAD_RATE_LIMIT", "2/minute")
    email = "cand-rl@example.com"
    assert _register(client, email).status_code == 201
    assert _login(client, email).status_code == 204

    for i in range(2):
        res = _upload(
            client,
            title=f"RL {i}",
            filename=f"rl{i}.pdf",
            data=_pdf_with_text(f"RL {i}"),
            content_type="application/pdf",
        )
        assert res.status_code == 201, res.text

    blocked = _upload(
        client,
        title="RL 3",
        filename="rl3.pdf",
        data=_pdf_with_text("RL 3"),
        content_type="application/pdf",
    )
    assert blocked.status_code == 429
    assert "Retry-After" in blocked.headers


def test_files_land_under_upload_dir(client, tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    email = "cand-disk@example.com"
    assert _register(client, email).status_code == 201
    assert _login(client, email).status_code == 204
    res = _upload(
        client,
        title="Disk",
        filename="disk.pdf",
        data=_pdf_with_text(),
        content_type="application/pdf",
    )
    assert res.status_code == 201
    stored = list((Path(tmp_path) / "resumes").glob("*.pdf"))
    assert len(stored) == 1
