import React, { useRef, useEffect, useState } from "react";
import dicomParser from "dicom-parser";
import cornerstone from "cornerstone-core";
import cornerstoneWADOImageLoader from "cornerstone-wado-image-loader";
import JSZip from "jszip";
import "./App.css";
import jsPDF from "jspdf";
import { FaUpload } from "react-icons/fa";

const App: React.FC = () => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [imageList, setImageList] = useState<{ id: string; file: Blob }[]>([]);
    const [processedImage, setProcessedImage] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [imagesPerPage, setImagesPerPage] = useState(5); // State pour le nombre d'images par page
    const maxPageButtons = 5;
    const [selectedImages, setSelectedImages] = useState<{ [key: number]: boolean }>({});
    const [annotation, setAnnotation] = useState<string>("");
    let dicomFile: File | null = null;

    useEffect(() => {
        cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
        cornerstoneWADOImageLoader.external.dicomParser = dicomParser;
    }, []);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.name.endsWith(".zip")) {
                const zip = new JSZip();
                const zipContent = await zip.loadAsync(file);
                const dicomImages: { id: string; file: Blob }[] = [];

                for (const relativePath in zipContent.files) {
                    const zipEntry = zipContent.files[relativePath];
                    if (!zipEntry.dir) {
                        const arrayBuffer = await zipEntry.async("arraybuffer");
                        const blob = new Blob([arrayBuffer], { type: "application/dicom" });
                        const imageId = cornerstoneWADOImageLoader.wadouri.fileManager.add(blob);
                        dicomImages.push({ id: imageId, file: blob });
                    }
                }
                setImageList(dicomImages);
                dicomFile = file;
            } else if (file.name.endsWith(".dcm")) {
                const reader = new FileReader();
                reader.onload = async function (e) {
                    const arrayBuffer = e.target?.result as ArrayBuffer;
                    const blob = new Blob([arrayBuffer], { type: "application/dicom" });
                    const imageId = cornerstoneWADOImageLoader.wadouri.fileManager.add(blob);
                    setImageList([{ id: imageId, file: blob }]);
                };
                reader.readAsArrayBuffer(file);
                dicomFile = file;
            }
        }
    };

    const handleCheckboxChange = (index: number) => {
        setSelectedImages((prevSelected) => ({
            ...prevSelected,
            [index]: !prevSelected[index],
        }));
    };

    const applyFilter = async (dicomFile: Blob) => {
        const formData = new FormData();
        formData.append("file", dicomFile, "image.dcm");

        try {
            const response = await fetch("http://127.0.0.1:8000/process-dicom/", {
                method: "POST",
                body: formData,
            });

            if (response.ok) {
                const blob = await response.blob();
                setProcessedImage(URL.createObjectURL(blob));
            } else {
                console.error("Error processing image:", await response.text());
            }
        } catch (error) {
            console.error("Error applying filter:", error);
        }
    };

    /**
     * Modification ici : utilisation d'une boucle for/await pour séquencer l'export.
     */
    const handleSave = async () => {
        const doc = new jsPDF();

        // Page d'annotation (première page par défaut dans jsPDF)
        doc.text("Annotation: " + annotation, 10, 10);

        // On parcourt toutes les images de la liste
        for (let index = 0; index < imageList.length; index++) {
            // Vérifie si l'image a été sélectionnée
            if (selectedImages[index]) {
                const { id: imageId } = imageList[index];

                // Crée dynamiquement un container pour charger l'image via Cornerstone
                const element = document.createElement("div");
                element.style.width = "512px";
                element.style.height = "512px";
                element.style.position = "absolute";
                element.style.left = "-9999px"; // Le cacher hors-écran
                document.body.appendChild(element);

                cornerstone.enable(element);

                try {
                    // Chargement de l'image DICOM
                    const image = await cornerstone.loadImage(imageId);
                    cornerstone.displayImage(element, image);

                    // On attend un petit délai pour que l'image se rende dans le canvas
                    await new Promise((resolve) => setTimeout(resolve, 800));

                    // Récupération du canvas et ajout dans le PDF
                    const canvas = element.querySelector("canvas");
                    if (canvas) {
                        const imgData = canvas.toDataURL("image/png");

                        // On ajoute une nouvelle page *après* la page d'annotation
                        doc.addPage();
                        doc.text("Image index: " + index, 10, 20);
                        doc.addImage(imgData, "PNG", 10, 30, 180, 160);
                    }
                } catch (error) {
                    console.error("Erreur lors du chargement ou de l'affichage de l'image:", error);
                } finally {
                    // Nettoyage du DOM
                    document.body.removeChild(element);
                }
            }
        }

        // S'il y a une image filtrée à inclure
        if (processedImage) {
            doc.addPage();
            doc.text("Image filtrée:", 10, 20);
            doc.addImage(processedImage, "PNG", 10, 30, 180, 160);
        }

        // Enfin, on enregistre le PDF
        doc.save("selected-dicom-images.pdf");
    };

    // Calcul de la pagination
    const indexOfLastImage = currentPage * imagesPerPage;
    const indexOfFirstImage = indexOfLastImage - imagesPerPage;
    const currentImages = imageList.slice(indexOfFirstImage, indexOfLastImage);

    const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

    const renderPageButtons = () => {
        const totalPages = Math.ceil(imageList.length / imagesPerPage);
        const pageButtons = [];

        let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
        let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);

        if (endPage - startPage < maxPageButtons - 1) {
            startPage = Math.max(1, endPage - maxPageButtons + 1);
        }

        if (startPage > 1) {
            pageButtons.push(
                <button key="first" onClick={() => paginate(1)} className="page-button">
                    1
                </button>
            );
            if (startPage > 2) {
                pageButtons.push(<span key="ellipsis-start" className="ellipsis">...</span>);
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            pageButtons.push(
                <button
                    key={i}
                    onClick={() => paginate(i)}
                    className={`page-button ${i === currentPage ? "active" : ""}`}
                >
                    {i}
                </button>
            );
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                pageButtons.push(<span key="ellipsis-end" className="ellipsis">...</span>);
            }
            pageButtons.push(
                <button key="last" onClick={() => paginate(totalPages)} className="page-button">
                    {totalPages}
                </button>
            );
        }

        return pageButtons;
    };

    // Fonction pour gérer le changement du nombre d'images par page
    const handleImagesPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setImagesPerPage(Number(e.target.value));
        setCurrentPage(1); // Réinitialiser la page courante
    };

    return (
        <div className="container">
            <h1>DICOM File Upload and Processing</h1>
            <div className="upload-container">
                {/* Hidden file input */}
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".dcm"
                    className="hidden-input"
                />

                {/* Custom Upload Button */}
                <button
                    className="upload-button"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <FaUpload className="upload-icon" />
                    Upload DICOM
                </button>

                {/* Show selected file name */}
                {dicomFile && <p className="file-name">{dicomFile.name}</p>}
            </div>

            {/* Sélecteur pour le nombre d'images par page */}
            <div style={{ marginBottom: "20px", textAlign: "center" }}>
                <label htmlFor="imagesPerPage">Nombre d'images par page : </label>
                <select id="imagesPerPage" value={imagesPerPage} onChange={handleImagesPerPageChange}>
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                </select>
            </div>

            {imageList.length > 0 && (
                <>
                    <table className="dicom-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Original Preview</th>
                                <th>Filter</th>
                                <th>Select</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentImages.map((image, index) => {
                                // index dans la page courante
                                const globalIndex = index + indexOfFirstImage; 
                                return (
                                    <tr key={globalIndex}>
                                        <td>{globalIndex + 1}</td>
                                        <td>
                                            <div className="dicom-container" id={`dicom-${globalIndex}`} />
                                            {setTimeout(() => {
                                                const element = document.getElementById(`dicom-${globalIndex}`);
                                                if (element) {
                                                    cornerstone.enable(element);
                                                    cornerstone.loadImage(image.id).then((img: any) => {
                                                        cornerstone.displayImage(element, img);
                                                    });
                                                }
                                            }, 100)}
                                        </td>
                                        <td>
                                            <button className="button" onClick={() => applyFilter(image.file)}>
                                                Apply Noise Reduction
                                            </button>
                                        </td>
                                        <td>
                                            <input
                                                type="checkbox"
                                                className="select-checkbox"
                                                checked={!!selectedImages[globalIndex]}
                                                onChange={() => handleCheckboxChange(globalIndex)}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    <div className="pagination">{renderPageButtons()}</div>

                    {/* Zone d'annotation et bouton d'exportation en PDF */}
                    <div className="save-section">
                        <textarea
                            className="annotation-textarea"
                            placeholder="Enter annotation..."
                            value={annotation}
                            onChange={(e) => setAnnotation(e.target.value)}
                        />
                        <button className="button save-button" onClick={handleSave}>
                            Save Selected Images
                        </button>
                    </div>
                </>
            )}

            {processedImage && (
                <div className="filtered-image-container">
                    <h2>Filtered Image</h2>
                    <img src={processedImage} alt="Filtered DICOM" className="filtered-image" />
                </div>
            )}
        </div>
    );
};

export default App;
