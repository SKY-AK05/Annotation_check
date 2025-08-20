so i was working scorring part perviously i seen its giving approx same for eveyone i dont why so what i do now is share the code of organinztion which is using evelaute scoress look at it and anylaziz it 

import os
import zipfile
import json
import xml.etree.ElementTree as ET
import pandas as pd
from pathlib import Path

# Configurable paths (IMAGE_DIR removed)
GT_JSON_PATH = r"C:\Users\Aakash\Downloads\OneDrive_2025-08-18\License Plate\GT_License_plates.json"  # Path to ground truth JSON file
PARENT_ZIP_PATH = r"C:\Users\Aakash\Downloads\OneDrive_2025-08-18\License Plate\batch\batch.zip"     # Path to parent ZIP containing student ZIPs
OUTPUT_DIR = r"C:\Users\Aakash\Downloads\OneDrive_2025-08-18\License Plate\Results"                  # Directory where results will be saved

def extract_zip(parent_zip_path, extract_to):
    """Extract parent zip containing student zips"""
    with zipfile.ZipFile(parent_zip_path, 'r') as zip_ref:
        zip_ref.extractall(extract_to)
    return [os.path.join(extract_to, f) for f in os.listdir(extract_to) if f.endswith('.zip')]

def extract_student_zip(student_zip_path, extract_to):
    """Extract individual student zip"""
    with zipfile.ZipFile(student_zip_path, 'r') as zip_ref:
        zip_ref.extractall(extract_to)
    return [os.path.join(extract_to, f) for f in os.listdir(extract_to) if f.endswith('.xml')]

def parse_cvat_xml_to_json(xml_file):
    """Convert CVAT XML (student submission) to JSON format"""
    tree = ET.parse(xml_file)
    root = tree.getroot()
    
    student_json = {}
    for image in root.findall('.//image'):
        image_name = image.get('name')
        boxes = []
        for box in image.findall('box'):
            box_data = {
                'label': box.get('label'),
                'xtl': float(box.get('xtl')),
                'ytl': float(box.get('ytl')),
                'xbr': float(box.get('xbr')),
                'ybr': float(box.get('ybr'))
            }
            boxes.append(box_data)
        student_json[image_name] = boxes
    
    print(f"Parsed XML {xml_file}: {list(student_json.keys())}")
    return student_json

def parse_cvat_gt_json(gt_json):
    """Convert GT JSON to a lookup dictionary with ID mapping, no image_dir filtering"""
    gt_images = {}
    id_to_name = {}
    
    for image in gt_json['image']:
        image_id = image['id']
        image_name = image['name']
        image_basename = os.path.basename(image_name)
        
        id_to_name[image_basename] = image_id
        if 'box' in image and image['box']:  # Check if 'box' exists and is not empty
            # Take the first box if it's a list
            box = image['box'][0] if isinstance(image['box'], list) else image['box']
            gt_images[image_basename] = {
                'xtl': float(box['xtl']),
                'ytl': float(box['ytl']),
                'xbr': float(box['xbr']),
                'ybr': float(box['ybr']),
                'label': box['label']
            }
        else:
            gt_images[image_basename] = None
        print(f"GT included: {image_basename} (ID: {image_id})")
    
    return gt_images, id_to_name

def calculate_iou(box1, box2):
    """Calculate Intersection over Union (IoU) between two boxes"""
    x1, y1, x2, y2 = box1['xtl'], box1['ytl'], box1['xbr'], box1['ybr']
    x3, y3, x4, y4 = box2['xtl'], box2['ytl'], box2['xbr'], box2['ybr']
    
    xi1 = max(x1, x3)
    yi1 = max(y1, y3)
    xi2 = min(x2, x4)
    yi2 = min(y2, y4)
    
    inter_area = max(0, xi2 - xi1) * max(0, yi2 - yi1)
    box1_area = (x2 - x1) * (y2 - y1)
    box2_area = (x4 - x3) * (y4 - y3)
    
    union_area = box1_area + box2_area - inter_area
    return inter_area / union_area if union_area > 0 else 0

def calculate_accuracy_metrics(iou):
    """Calculate quality rating, deduction, and final score based on IoU"""
    if iou >= 0.9:
        return "Perfect", 0.0, 100.0
    elif iou >= 0.8:
        return "Excellent", 20.0, 80.0
    elif iou >= 0.7:
        return "Good", 40.0, 60.0
    elif iou >= 0.6:
        return "Fair", 60.0, 40.0
    elif iou >= 0.5:
        return "Poor", 80.0, 20.0
    else:
        return "Fail", 100.0, 0.0

def score_submission(gt_images, student_json, id_to_name):
    """Calculate scores including IoU, no image_dir filtering"""
    scores = {}
    
    print(f"Student annotations from converted JSON: {list(student_json.keys())}")
    print(f"GT images (basenames): {list(gt_images.keys())}")
    
    for image_name, pred_boxes in student_json.items():
        image_basename = os.path.basename(image_name)
        
        print(f"Processing student image: {image_basename}")
        if image_basename not in gt_images:
            print(f"  Skipped: {image_basename} not in GT")
            continue
        
        image_id = id_to_name[image_basename]
        gt_box = gt_images[image_basename]
        
        if gt_box is None:
            scores[image_id] = {'rating': 'Fail', 'deduction': 100.0, 'final_score': 0.0, 'iou': 0.0}
            print(f"  No GT box for {image_basename}")
            continue
            
        if not pred_boxes:
            scores[image_id] = {'rating': 'Fail', 'deduction': 100.0, 'final_score': 0.0, 'iou': 0.0}
            print(f"  No student box for {image_basename}")
            continue
            
        pred_box = pred_boxes[0]  # Assuming single box per image
        iou = calculate_iou(pred_box, gt_box)
        rating, deduction, final_score = calculate_accuracy_metrics(iou)
        
        scores[image_id] = {
            'rating': rating,
            'deduction': deduction,
            'final_score': final_score,
            'iou': iou
        }
        print(f"  Processed: {image_id} ({image_basename}) with IoU {iou}")
    
    for gt_image_basename, gt_box in gt_images.items():
        if gt_image_basename not in [os.path.basename(n) for n in student_json.keys()] and gt_box is not None:
            image_id = id_to_name[gt_image_basename]
            scores[image_id] = {'rating': 'Fail', 'deduction': 100.0, 'final_score': 0.0, 'iou': 0.0}
            print(f"GT image {gt_image_basename} not in student submission")
    
    return scores

def process_submissions(gt_json, parent_zip_path, output_dir):
    """Process submissions and generate scores with IoU, plus combined Excel"""
    extract_dir = os.path.join(output_dir, 'extracted')
    os.makedirs(extract_dir, exist_ok=True)
    
    gt_images, id_to_name = parse_cvat_gt_json(gt_json)
    print(f"GT images processed: {len(gt_images)} images")
    
    student_zips = extract_zip(parent_zip_path, extract_dir)

    all_students_scores = []  # 🔥 collect all scores here
    
    for student_zip in student_zips:
        student_id = Path(student_zip).stem
        student_dir = os.path.join(output_dir, student_id)
        student_extract_dir = os.path.join(extract_dir, student_id)
        os.makedirs(student_dir, exist_ok=True)
        os.makedirs(student_extract_dir, exist_ok=True)
        
        xml_files = extract_student_zip(student_zip, student_extract_dir)
        
        student_json = {}
        for xml_file in xml_files:
            student_json.update(parse_cvat_xml_to_json(xml_file))
        
        json_output_path = os.path.join(student_dir, 'converted_annotations.json')
        with open(json_output_path, 'w') as f:
            json.dump(student_json, f, indent=2)
        
        scores = score_submission(gt_images, student_json, id_to_name)
        
        scores_data = [
            {
                'Student ID': student_id,
                'Image ID': image_id,
                'Annotation Quality Rating': score['rating'],
                'Deduction (%)': score['deduction'],
                'Final Score': score['final_score'],
                'IoU': score['iou']
            }
            for image_id, score in scores.items()
        ]
        df_scores = pd.DataFrame(scores_data)
        
        total_images = len(scores)
        avg_final_score = df_scores['Final Score'].mean() if total_images > 0 else 0.0
        
        scores_data.append({
            'Student ID': student_id,
            'Image ID': 'Average',
            'Annotation Quality Rating': '',
            'Deduction (%)': '',
            'Final Score': avg_final_score,
            'IoU': ''
        })
        df_scores_with_avg = pd.DataFrame(scores_data)
        
        # Save individual CSV (optional, still per-student)
        csv_output_path = os.path.join(student_dir, 'scores.csv')
        df_scores_with_avg.to_csv(csv_output_path, index=False)
        print(f"Saved scores for {student_id} to {csv_output_path}")

        # 🔥 Append to combined list
        all_students_scores.append(df_scores_with_avg)
    
    # 🔥 Merge all students into one Excel file
    combined_df = pd.concat(all_students_scores, ignore_index=True)
    excel_output_path = os.path.join(output_dir, 'all_scores.xlsx')
    combined_df.to_excel(excel_output_path, index=False)
    print(f"\n🔥 Combined results saved in: {excel_output_path}")

# Main execution
if __name__ == "__main__":
    with open(GT_JSON_PATH, 'r') as f:
        gt_json = json.load(f)
    process_submissions(gt_json, PARENT_ZIP_PATH, OUTPUT_DIR)





so we use the annoataotion accuracy has final scores for this code i will share one more code 


import os
import zipfile
import json
import xml.etree.ElementTree as ET
import pandas as pd
import difflib

# Helper function to compute string similarity using difflib
def string_similarity(str1, str2):
    seq_match = difflib.SequenceMatcher(None, str1, str2)
    similarity = seq_match.ratio()  # Float between 0 and 1
    return round(similarity * 5, 2)  # Scale to 0–5 and round to 2 decimal places

# Helper function to extract parent ZIP
def extract_parent_zip(parent_zip_path, output_dir):
    with zipfile.ZipFile(parent_zip_path, 'r') as parent_zip:
        parent_zip.extractall(output_dir)
    return [os.path.join(output_dir, f) for f in os.listdir(output_dir) if f.endswith('.zip')]

# Helper function to extract student ZIP
def extract_student_zip(student_zip_path, output_dir):
    with zipfile.ZipFile(student_zip_path, 'r') as student_zip:
        student_zip.extractall(output_dir)
    xml_files = [f for f in os.listdir(output_dir) if f.endswith('.xml')]
    return os.path.join(output_dir, xml_files[0]) if xml_files else None

# Convert XML to JSON with ordered boxes
def xml_to_json(xml_path, student_name):
    tree = ET.parse(xml_path)
    root = tree.getroot()
    json_data = {"image": []}
    
    for image in root.findall('.//image'):
        img_id = image.get('id')
        img_name = image.get('name')
        img_width = image.get('width')
        img_height = image.get('height')
        boxes = []
        licence_plate_box = None
        char_boxes = []
        
        for box in image.findall('box'):
            label = box.get('label')
            box_data = {
                "label": label,
                "source": "manual",
                "occluded": "0",
                "xtl": box.get('xtl'),
                "ytl": box.get('ytl'),
                "xbr": box.get('xbr'),
                "ybr": box.get('ybr'),
                "z_order": "0"
            }
            if label == 'licence_plates':
                attr = box.find('attribute')
                plate_number = attr.text if attr is not None and attr.text is not None else ""
                if plate_number:
                    box_data["attribute"] = {"name": "licence_plate_number", "#text": plate_number}
                    box_data["characters"] = list(plate_number)
                licence_plate_box = box_data
            else:
                char_boxes.append(box_data)
        
        # Order character boxes based on plate number
        if licence_plate_box and "attribute" in licence_plate_box:
            plate_number = licence_plate_box["attribute"]["#text"]
            ordered_char_boxes = []
            for char in plate_number:
                for char_box in char_boxes[:]:
                    if char_box["label"] == char and char_box not in ordered_char_boxes:
                        ordered_char_boxes.append(char_box)
                        char_boxes.remove(char_box)
                        break
            ordered_char_boxes.extend(char_boxes)
        else:
            ordered_char_boxes = char_boxes
        
        # Reorder: licence_plates first, then ordered characters
        final_boxes = []
        if licence_plate_box:
            final_boxes.append(licence_plate_box)
        final_boxes.extend(ordered_char_boxes)
        
        json_data["image"].append({
            "id": img_id,
            "name": img_name,
            "width": img_width,
            "height": img_height,
            "box": final_boxes
        })
    
    return json_data

# Reorder GT JSON
def reorder_gt_json(gt_json):
    reordered_gt = {"image": []}
    
    for image in gt_json["image"]:
        img_id = image["id"]
        img_name = image["name"]
        img_width = image["width"]
        img_height = image["height"]
        boxes = image["box"]
        licence_plate_box = None
        char_boxes = []
        
        for box in boxes:
            if box["label"] == "licence_plates":
                licence_plate_box = box.copy()
                plate_number = licence_plate_box.get("attribute", {}).get("#text", "")
                licence_plate_box["characters"] = list(plate_number)
            else:
                char_boxes.append(box)
        
        if licence_plate_box and "attribute" in licence_plate_box and "#text" in licence_plate_box["attribute"]:
            plate_number = licence_plate_box["attribute"]["#text"]
            ordered_char_boxes = []
            for char in plate_number:
                for char_box in char_boxes[:]:
                    if char_box["label"] == char and char_box not in ordered_char_boxes:
                        ordered_char_boxes.append(char_box)
                        char_boxes.remove(char_box)
                        break
            ordered_char_boxes.extend(char_boxes)
        else:
            ordered_char_boxes = char_boxes
        
        final_boxes = []
        if licence_plate_box:
            final_boxes.append(licence_plate_box)
        final_boxes.extend(ordered_char_boxes)
        
        reordered_gt["image"].append({
            "id": img_id,
            "name": img_name,
            "width": img_width,
            "height": img_height,
            "box": final_boxes
        })
    
    return reordered_gt

# Calculate IoU
def calculate_iou(box1, box2):
    x1, y1, x2, y2 = float(box1['xtl']), float(box1['ytl']), float(box1['xbr']), float(box1['ybr'])
    x1_gt, y1_gt, x2_gt, y2_gt = float(box2['xtl']), float(box2['ytl']), float(box2['xbr']), float(box2['ybr'])
    
    xi1, yi1 = max(x1, x1_gt), max(y1, y1_gt)
    xi2, yi2 = min(x2, x2_gt), min(y2, y2_gt)
    
    inter_width = max(0, xi2 - xi1)
    inter_height = max(0, yi2 - yi1)
    inter_area = inter_width * inter_height
    
    box1_area = (x2 - x1) * (y2 - y1)
    box2_area = (x2_gt - x1_gt) * (y2_gt - y1_gt)
    union_area = box1_area + box2_area - inter_area
    
    return inter_area / union_area if union_area > 0 else 0

# Score IoU
def score_iou(iou):
    if iou >= 0.9: return 5
    elif iou >= 0.7: return 4
    elif iou >= 0.5: return 3
    elif iou >= 0.3: return 2
    elif iou > 0: return 1
    return 0

# Updated Score student JSON against GT JSON with difflib similarity
def score_student(student_json, gt_json, student_dir, student_name):
    data = []
    iou_total_score, iou_max_score = 0, 0
    label_total_score, label_max_score = 0, 0
    attr_total_score, attr_max_score = 0, 0
    
    for student_img, gt_img in zip(student_json["image"][:250], gt_json["image"][:250]):
        if student_img["id"] != gt_img["id"]:
            print(f"Warning: Image ID mismatch for {student_name}: {student_img['id']} vs {gt_img['id']}")
            continue
        
        img_id = student_img["id"]
        student_boxes = student_img["box"]
        gt_boxes = gt_img["box"]
        
        used_student_indices = set()
        
        for gt_box in gt_boxes:
            gt_label = gt_box["label"]
            best_match_idx = None
            best_iou = -1
            
            for i, student_box in enumerate(student_boxes):
                if i in used_student_indices:
                    continue
                student_label = student_box["label"]
                
                if student_label == gt_label:
                    iou = calculate_iou(student_box, gt_box)
                    if iou > best_iou:
                        best_iou = iou
                        best_match_idx = i
            
            if best_match_idx is not None:
                student_box = student_boxes[best_match_idx]
                student_label = student_box["label"]
                used_student_indices.add(best_match_idx)
                
                label_score = 5
                label_total_score += label_score
                label_max_score += 5
                
                iou_score = score_iou(best_iou)
                iou_total_score += iou_score
                iou_max_score += 5
                
                attr_score = 0
                student_text = gt_text = ""
                if gt_label == "licence_plates":
                    student_text = student_box.get("attribute", {}).get("#text", "")
                    gt_text = gt_box.get("attribute", {}).get("#text", "")
                    # Use string similarity for attribute scoring
                    if gt_text:
                        attr_score = string_similarity(gt_text, student_text)  # Score from 0 to 5
                    attr_total_score += attr_score
                    attr_max_score += 5
                
                data.append([student_name, img_id, gt_label, student_label, gt_label, gt_text, student_text, best_iou, iou_score, label_score, attr_score])
            else:
                data.append([student_name, img_id, gt_label, "Missing", gt_label, gt_text, "", 0, 0, 0, 0])
                iou_max_score += 5
                label_max_score += 5
                if gt_label == "licence_plates":
                    attr_max_score += 5
        
        for i, student_box in enumerate(student_boxes):
            if i not in used_student_indices:
                student_label = student_box["label"]
                data.append([student_name, img_id, "Extra", student_label, "", "", "", 0, 0, 0, 0])
                iou_max_score += 5
                label_max_score += 5
                if student_label == "licence_plates":
                    attr_max_score += 5
    
    iou_accuracy = (iou_total_score / iou_max_score * 100) if iou_max_score > 0 else 0
    label_accuracy = (label_total_score / label_max_score * 100) if label_max_score > 0 else 0
    attr_accuracy = (attr_total_score / attr_max_score * 100) if attr_max_score > 0 else 0
    
    df = pd.DataFrame(data, columns=['Annotator', 'Image ID', 'GT Label', 'Annotator Label', 'GT Label Value', 'GT Text', 'Annotator Text', 'IoU', 'Box Score', 'Label Score', 'Attribute Score'])
    
    summary = pd.DataFrame([
        [student_name, '', '', '', '', '', 'IoU Total Score', iou_total_score, f"{iou_total_score}/{iou_max_score}", '', ''],
        [student_name, '', '', '', '', '', 'IoU Accuracy (%)', iou_accuracy, '', '', ''],
        [student_name, '', '', '', '', '', 'Label Total Score', label_total_score, f"{label_total_score}/{label_max_score}", '', ''],
        [student_name, '', '', '', '', '', 'Label Accuracy (%)', label_accuracy, '', '', ''],
        [student_name, '', '', '', '', '', 'Attribute Total Score', attr_total_score, f"{attr_total_score}/{attr_max_score}", '', ''],
        [student_name, '', '', '', '', '', 'Attribute Accuracy (%)', attr_accuracy, '', '', '']
    ], columns=df.columns)
    df = pd.concat([df, summary], ignore_index=True)
    
    excel_path = os.path.join(student_dir, f'{student_name}_scores.xlsx')
    df.to_excel(excel_path, index=False)
    print(f"Saved Excel scores to {excel_path}")
    
    return iou_total_score, iou_max_score, iou_accuracy, label_total_score, label_max_score, label_accuracy, attr_total_score, attr_max_score, attr_accuracy

# Main function
def main():
    parent_zip_path = r"C:\Users\Ragul\Desktop\License Plate with OCR\batch1.zip"
    output_dir = r"C:\Users\Ragul\Desktop\License Plate with OCR\results"
    gt_json_path = r"C:\Users\Ragul\Desktop\License Plate with OCR\GT1.json"

    os.makedirs(output_dir, exist_ok=True)

    with open(gt_json_path, 'r') as f:
        gt_json = json.load(f)
    gt_json = reorder_gt_json(gt_json)

    print("Extracting parent ZIP...")
    student_zips = extract_parent_zip(parent_zip_path, output_dir)

    for student_zip in student_zips:
        student_name = os.path.splitext(os.path.basename(student_zip))[0]
        student_dir = os.path.join(output_dir, student_name)
        print(f"Processing {student_name}...")

        xml_path = extract_student_zip(student_zip, student_dir)
        if not xml_path:
            print(f"No XML found in {student_name}")
            continue

        json_data = xml_to_json(xml_path, student_name)
        json_output_path = os.path.join(student_dir, f'{student_name}.json')
        with open(json_output_path, 'w') as f:
            json.dump(json_data, f, indent=2)

        iou_score, iou_max, iou_acc, label_score, label_max, label_acc, attr_score, attr_max, attr_acc = score_student(json_data, gt_json, student_dir, student_name)
        print(f"{student_name} IoU Score: {iou_score}/{iou_max}, IoU Accuracy: {iou_acc:.2f}%")
        print(f"{student_name} Label Score: {label_score}/{label_max}, Label Accuracy: {label_acc:.2f}%")
        print(f"{student_name} Attribute Score: {attr_score}/{attr_max}, Attribute Accuracy: {attr_acc:.2f}%")

if __name__ == "__main__":
    main()

this 



after running this code we mauall sort the data in one place for all the students and each studenst 3 scores take out the average 