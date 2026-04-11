from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Date, JSON, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

Base = declarative_base()

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    aoi_geojson = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    images = relationship("Image", back_populates="project", cascade="all, delete-orphan")
    change_detections = relationship("ChangeDetection", back_populates="project", cascade="all, delete-orphan")
    compliance = relationship("Compliance", back_populates="project", cascade="all, delete-orphan")

class Image(Base):
    __tablename__ = "images"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    type = Column(String(4), nullable=False) # 't1' or 't2'
    source = Column(String(50), nullable=False, default="s2dr3")
    date = Column(Date, nullable=False)
    tci_png_path = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    project = relationship("Project", back_populates="images")
    indices = relationship("Index", back_populates="image", cascade="all, delete-orphan")

class Index(Base):
    __tablename__ = "indices"
    
    id = Column(Integer, primary_key=True, index=True)
    image_id = Column(Integer, ForeignKey("images.id", ondelete="CASCADE"), index=True)
    index_type = Column(String(10), nullable=False)
    image_path = Column(Text)
    mean_value = Column(Float)
    
    image = relationship("Image", back_populates="indices")

class ChangeDetection(Base):
    __tablename__ = "change_detection"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"))
    t1_image_id = Column(Integer, ForeignKey("images.id"))
    t2_image_id = Column(Integer, ForeignKey("images.id"))
    mask_path = Column(Text)
    confidence = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    project = relationship("Project", back_populates="change_detections")

class Compliance(Base):
    __tablename__ = "compliance"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"))
    rule_name = Column(String(255), nullable=False)
    description = Column(Text)
    status = Column(String(20), default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    project = relationship("Project", back_populates="compliance")
