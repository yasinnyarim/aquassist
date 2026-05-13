try:
    import models
    from database import engine
    from sqlalchemy import text
    models.Base.metadata.create_all(bind=engine)
    print("Tables created")
except Exception as e:
    import traceback
    traceback.print_exc()
