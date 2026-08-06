# scratch/create_disguised_excel.py
import os
import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter

def create_template():
    wb = openpyxl.Workbook()
    
    # ----------------------------------------------------
    # Sheet 1: Bang cham diem (KPI Scoring Sheet)
    # ----------------------------------------------------
    ws = wb.active
    ws.title = "KPI_Scoring"
    ws.views.sheetView[0].showGridLines = True
    
    # Kieu dang style
    header_fill = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid") # Dark blue
    header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
    data_font = Font(name="Segoe UI", size=10)
    data_align_center = Alignment(horizontal="center", vertical="center")
    data_align_left = Alignment(horizontal="left", vertical="center")
    header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    
    thin_border = Border(
        left=Side(style='thin', color='BFBFBF'),
        right=Side(style='thin', color='BFBFBF'),
        top=Side(style='thin', color='BFBFBF'),
        bottom=Side(style='thin', color='BFBFBF')
    )
    
    headers = [
        "Ngày\n(YYYY-MM-DD)", "MSNV\nNhân viên", "Họ & tên\nNhân viên", 
        "MSNV\nNgười duyệt", "Họ & tên\nNgười duyệt", "Bộ phận\n(Area)", 
        "Chuyền\n(Line)", "Ca\n(1/2/3)", "Giờ làm\nviệc", "Giờ dừng\nmáy", 
        "Target/Giờ\n(Mục tiêu)", "Số lỗi\n(Defects)", "Tỷ lệ OE\n(%)", 
        "Mã vi phạm\n(Compliance)", "Trạng thái\nđồng bộ"
    ]
    
    # Ghi header
    ws.row_dimensions[1].height = 40
    for col_idx, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = header_align
        cell.border = thin_border
        
    # Ghi du lieu mau (Sample data)
    sample_data = [
        ["2026-07-13", "12345", "Nguyen Van A", "54321", "Tran Thi B", "MOLDING", "LINE_01", 1, 8.0, 0.5, 100, 0, 102.5, "", ""],
        ["2026-07-13", "67890", "Le Van C", "54321", "Tran Thi B", "MOLDING", "LINE_02", 1, 8.0, 0.0, 120, 2, 98.0, "", ""],
    ]
    
    for row_idx, row_data in enumerate(sample_data, 2):
        ws.row_dimensions[row_idx].height = 22
        for col_idx, val in enumerate(row_data, 1):
            cell = ws.cell(row=row_idx, column=col_idx, value=val)
            cell.font = data_font
            cell.border = thin_border
            if col_idx in [1, 2, 4, 6, 7, 8, 14, 15]:
                cell.alignment = data_align_center
            else:
                cell.alignment = data_align_left
                
    # Tu dong dat do rong cot
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            val_str = str(cell.value or '')
            lines = val_str.split('\n')
            for line in lines:
                if len(line) > max_len:
                    max_len = len(line)
        ws.column_dimensions[col_letter].width = max(max_len + 4, 12)
        
    # ----------------------------------------------------
    # Sheet 2: Huong dan chen VBA (VBA Guidelines Sheet)
    # ----------------------------------------------------
    ws_guide = wb.create_sheet(title="Huong_dan_VBA")
    ws_guide.views.sheetView[0].showGridLines = True
    
    ws_guide.column_dimensions['A'].width = 100
    ws_guide.row_dimensions[1].height = 30
    
    title_cell = ws_guide.cell(row=1, column=1, value="HƯỚNG DẪN THIẾT LẬP ĐỒNG BỘ SUPABASE QUA EXCEL (VBA)")
    title_cell.font = Font(name="Segoe UI", size=14, bold=True, color="1F4E78")
    
    vba_code = """' === COPY TOÀN BỘ MÃ NÀY DÁN VÀO VBA MODULE ===
Sub DongBoSupabase()
    Dim http As Object
    Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
    
    Dim url As String
    url = "https://doyipagavbxupiwbitgi.supabase.co/rest/v1/kpi_entries"
    
    Dim apiKey As String
    apiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRveWlwYWdhdmJ4dXBpd2JpdGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMTc0NzUsImV4cCI6MjA3NDc5MzQ3NX0.hRCtL5wOxFXFPAR_r0vyYsL044d0caT-EZqx-p9kva0"
    
    Dim ws As Worksheet
    Set ws = ThisWorkbook.Sheets("KPI_Scoring")
    
    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, "A").End(xlUp).Row
    
    If lastRow < 2 Then
        MsgBox "Không có dữ liệu để đồng bộ!", vbExclamation, "Thông báo"
        Exit Sub
    End If
    
    Dim i As Long
    Dim successCount As Long
    Dim failCount As Long
    
    For i = 2 To lastRow
        ' Kiem tra neu dong da duoc dong bo thi bo qua
        If Trim(CStr(ws.Cells(i, 15).Value)) = "Da dong bo" Then
            GoTo NextRow
        End If
        
        ' Kiem tra neu dong trong ngay thi bo qua
        If Trim(CStr(ws.Cells(i, 1).Value)) = "" Then
            GoTo NextRow
        End If
        
        Dim kpiDate As String: kpiDate = Format(ws.Cells(i, 1).Value, "yyyy-mm-dd")
        Dim workerId As String: workerId = Trim(CStr(ws.Cells(i, 2).Value))
        Dim workerName As String: workerName = Trim(CStr(ws.Cells(i, 3).Value))
        Dim approverId As String: approverId = Trim(CStr(ws.Cells(i, 4).Value))
        Dim approverName As String: approverName = Trim(CStr(ws.Cells(i, 5).Value))
        Dim area As String: area = Trim(CStr(ws.Cells(i, 6).Value))
        Dim line As String: line = Trim(CStr(ws.Cells(i, 7).Value))
        Dim ca As String: ca = Trim(CStr(ws.Cells(i, 8).Value))
        
        Dim workHours As Double: workHours = Val(Replace(CStr(ws.Cells(i, 9).Value), ",", "."))
        Dim stopHours As Double: stopHours = Val(Replace(CStr(ws.Cells(i, 10).Value), ",", "."))
        Dim targetPerHour As Double: targetPerHour = Val(Replace(CStr(ws.Cells(i, 11).Value), ",", "."))
        Dim defects As Long: defects = Val(ws.Cells(i, 12).Value)
        Dim oe As Double: oe = Val(Replace(CStr(ws.Cells(i, 13).Value), ",", "."))
        Dim compliance As String: compliance = Trim(CStr(ws.Cells(i, 14).Value))
        
        ' 1. Tinh pScore (Nang suat)
        Dim pScore As Long
        If oe >= 112 Then
            pScore = 10
        ElseIf oe >= 108 Then
            pScore = 9
        ElseIf oe >= 104 Then
            pScore = 8
        ElseIf oe >= 100 Then
            pScore = 7
        ElseIf oe >= 98 Then
            pScore = 6
        ElseIf oe >= 96 Then
            pScore = 4
        ElseIf oe >= 94 Then
            pScore = 2
        Else
            pScore = 0
        End If
        
        ' 2. Tinh qScore (Chat luong)
        Dim qScore As Long
        If defects = 0 Then
            qScore = 10
        ElseIf defects >= 1 And defects <= 2 Then
            qScore = 8
        ElseIf defects >= 3 And defects <= 4 Then
            qScore = 6
        ElseIf defects >= 5 And defects <= 6 Then
            qScore = 4
        Else
            qScore = 0
        End If
        
        ' 3. Tinh dayScore & overflow
        Dim rawScore As Long: rawScore = pScore + qScore
        Dim dayScore As Long: dayScore = rawScore
        If dayScore > 15 Then dayScore = 15
        
        Dim overflow As Long: overflow = rawScore - 15
        If overflow < 0 Then overflow = 0
        
        ' Format JSON string
        Dim json As String
        json = "{" & _
            ""\"date\"":\""" & kpiDate & "\"\"," & _
            ""\"worker_id\"":\""" & workerId & "\"\"," & _
            ""\"worker_name\"":\""" & workerName & "\"\"," & _
            ""\"approver_id\"":\""" & approverId & "\"\"," & _
            ""\"approver_name\"":\""" & approverName & "\"\"," & _
            ""\"area\"":\""" & area & "\"\"," & _
            ""\"line\"":\""" & line & "\"\"," & _
            ""\"ca\"":\""" & ca & "\"\"," & _
            ""\"work_hours\"":" & Replace(Str(workHours), ",", ".") & "," & _
            ""\"stop_hours\"":" & Replace(Str(stopHours), ",", ".") & "," & _
            ""\"line_target_per_hour\"":" & Replace(Str(targetPerHour), ",", ".") & "," & _
            ""\"defects\"":" & defects & "," & _
            ""\"oe\"":" & Replace(Str(oe), ",", ".") & "," & _
            ""\"compliance_code\"":\""" & compliance & "\"\"," & _
            ""\"p_score\"":" & pScore & "," & _
            ""\"q_score\"":" & qScore & "," & _
            ""\"day_score\"":" & dayScore & "," & _
            ""\"overflow\"":" & overflow & "," & _
            ""\"status\"":\""pending\""" & _
            "}"
            
        ' Gui du lieu
        http.Open "POST", url, False
        http.setRequestHeader "apikey", apiKey
        http.setRequestHeader "Authorization", "Bearer " & apiKey
        http.setRequestHeader "Content-Type", "application/json"
        http.setRequestHeader "Content-Profile", "kpi"
        
        On Error Resume Next
        http.send json
        
        If Err.Number <> 0 Then
            failCount = failCount + 1
            ws.Cells(i, 15).Value = "Loi gui: " & Err.Description
        Else
            If http.Status = 200 Or http.Status = 201 Then
                successCount = successCount + 1
                ws.Cells(i, 15).Value = "Da dong bo"
                ws.Cells(i, 15).Interior.Color = RGB(220, 245, 220) ' Light green background
            Else
                failCount = failCount + 1
                ws.Cells(i, 15).Value = "Loi: " & http.Status
                ws.Cells(i, 15).Interior.Color = RGB(255, 220, 220) ' Light red background
            End If
        End If
        On Error GoTo 0
        
NextRow:
    Next i
    
    MsgBox "Hoàn thành! Đã đồng bộ thành công: " & successCount & " dòng. Thất bại: " & failCount & " dòng.", vbInformation, "Thông báo"
End Sub
"""
    
    guide_text = [
        "CÁC BƯỚC THIẾT LẬP ĐỂ NGUỴ TRANG VÀ CHẠY ĐỒNG BỘ:",
        "------------------------------------------------------------------------------------------------",
        "Bước 1: Mở file này và chọn File -> Save As -> Đổi định dạng thành 'Excel Macro-Enabled Workbook (*.xlsm)'.",
        "Bước 2: Nhấn tổ hợp phím [Alt + F11] để mở giao diện soạn thảo Code (VBA Editor).",
        "Bước 3: Chọn Insert -> Module từ thanh menu.",
        "Bước 4: Copy toàn bộ đoạn mã VBA ở khung ô bên dưới (Dòng 10) và dán (Paste) vào cửa sổ Module vừa tạo.",
        "Bước 5: Nhấn [Alt + Q] để quay lại màn hình Excel chính.",
        "Bước 6: Tạo nút bấm kích hoạt:",
        "   - Chọn thẻ 'Developer' (nếu chưa có thẻ này, vào File -> Options -> Customize Ribbon -> tick chọn Developer).",
        "   - Nhấp chọn Insert -> Button (Form Control), vẽ nút bấm lên sheet.",
        "   - Chọn gán nút bấm với macro 'DongBoSupabase' và bấm OK.",
        "Bước 7: Nhập liệu các dòng vào sheet 'KPI_Scoring' và bấm nút vừa tạo để tự động đồng bộ lên Supabase server!",
        "",
        "ĐOẠN MÃ VBA ĐỂ COPY:"
    ]
    
    for row_idx, text in enumerate(guide_text, 3):
        cell = ws_guide.cell(row=row_idx, column=1, value=text)
        if row_idx == 3:
            cell.font = Font(name="Segoe UI", size=11, bold=True, color="FF0000")
        else:
            cell.font = Font(name="Segoe UI", size=10)
            
    # Ghi doan VBA code vao o lon A17
    code_cell = ws_guide.cell(row=17, column=1, value=vba_code)
    code_cell.font = Font(name="Consolas", size=9, color="006600")
    code_cell.alignment = Alignment(vertical="top", wrap_text=True)
    ws_guide.row_dimensions[17].height = 450
    
    # Save workbook
    os.makedirs("release", exist_ok=True)
    output_path = os.path.join("release", "KPI_Scoring_Template.xlsx")
    wb.save(output_path)
    print(f"Excel template successfully created at: {output_path}")

if __name__ == '__main__':
    create_template()
